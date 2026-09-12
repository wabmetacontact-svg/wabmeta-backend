// src/modules/instagram/instagram.inbox.ts
//
// Bridges Instagram DMs into WabMeta's unified inbox. Inbound webhook messages
// and agent replies both flow into the shared Conversation/Message tables with
// channel = INSTAGRAM, so Instagram behaves like any other channel in the inbox.

import axios from 'axios';
import prisma from '../../config/database';
import { webhookEvents } from '../webhooks/webhook.service';
import { sendIGMessage, sendIGAttachment } from './instagram.api';
import { igAccessToken } from './instagram.service';
import { maybeCreateSocialLead } from '../crm/crm.social';

type IgAccount = { id: string; organizationId: string; accessToken: string; username?: string | null };

/** Find or create the Contact for an Instagram DM sender (IGSID, no phone). */
const findOrCreateContact = async (organizationId: string, senderId: string, username?: string) => {
  const syntheticPhone = `ig:${senderId}`;
  return prisma.contact.upsert({
    where: { organizationId_phone: { organizationId, phone: syntheticPhone } },
    update: {
      instagramUserId: senderId,
      instagramUsername: username || undefined,
      lastMessageAt: new Date(),
    },
    create: {
      organizationId,
      phone: syntheticPhone,
      instagramUserId: senderId,
      instagramUsername: username || null,
      firstName: username || 'Instagram User',
      source: 'instagram',
      lastMessageAt: new Date(),
    },
  });
};

/** Find or create the INSTAGRAM conversation for a contact + IG account. */
const findOrCreateConversation = async (organizationId: string, contactId: string, instagramAccountId: string) => {
  return prisma.conversation.upsert({
    where: { organizationId_contactId_channel: { organizationId, contactId, channel: 'INSTAGRAM' } },
    update: { instagramAccountId },
    create: {
      organizationId,
      contactId,
      channel: 'INSTAGRAM',
      instagramAccountId,
      isWindowOpen: true,
    },
  });
};

/**
 * Store an inbound Instagram DM in the unified inbox and push it live. Called
 * from the Instagram webhook handler. Idempotent on the IG message id.
 */
const IG_ATTACH_TYPE: Record<string, 'IMAGE' | 'VIDEO' | 'AUDIO' | 'DOCUMENT'> = {
  image: 'IMAGE', video: 'VIDEO', audio: 'AUDIO', file: 'DOCUMENT', share: 'IMAGE', story_mention: 'IMAGE',
};

export const recordInboundIgMessage = async (
  account: IgAccount,
  senderId: string,
  message: { text?: string; mid?: string; attachments?: any[] },
  username?: string
): Promise<any> => {
  const igMessageId = message?.mid;
  const text = message?.text || '';
  const attachment = Array.isArray(message?.attachments) ? message.attachments[0] : null;
  const mediaUrlRaw: string | undefined = attachment?.payload?.url;
  const mType = attachment ? (IG_ATTACH_TYPE[String(attachment.type)] || 'DOCUMENT') : 'TEXT';

  if (!text && !mediaUrlRaw) return; // nothing renderable
  const organizationId = account.organizationId;

  const contact = await findOrCreateContact(organizationId, senderId, username);
  const conversation = await findOrCreateConversation(organizationId, contact.id, account.id);

  if (igMessageId) {
    const existing = await prisma.message
      .findFirst({
        where: {
          conversationId: conversation.id,
          channel: 'INSTAGRAM',
          direction: 'INBOUND',
          metadata: { path: ['igMessageId'], equals: igMessageId },
        },
        select: { id: true },
      })
      .catch(() => null);
    if (existing) return;
  }

  const preview = text || (mType === 'IMAGE' ? '📷 Photo' : mType === 'VIDEO' ? '🎥 Video' : mType === 'AUDIO' ? '🎙 Audio' : '📎 Attachment');

  const message_ = await prisma.message.create({
    data: {
      conversationId: conversation.id,
      channel: 'INSTAGRAM',
      direction: 'INBOUND',
      type: mType,
      content: text || null,
      mediaMimeType: mediaUrlRaw ? undefined : undefined,
      metadata: {
        ...(igMessageId ? { igMessageId } : {}),
        ...(mediaUrlRaw ? { igMediaUrl: mediaUrlRaw } : {}),
      },
      status: 'DELIVERED',
      timestamp: new Date(),
    },
  });

  // Media served through a token-authenticated proxy (source URLs expire / are CDN-locked).
  if (mediaUrlRaw) {
    await prisma.message.update({ where: { id: message_.id }, data: { mediaUrl: `/instagram/media/${message_.id}` } });
    (message_ as any).mediaUrl = `/instagram/media/${message_.id}`;
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

  webhookEvents.emit('newMessage', { organizationId, conversationId: conversation.id, message: message_, conversation: updatedConversation });
  webhookEvents.emit('conversationUpdated', { organizationId, conversation: updatedConversation });

  // Pehle asli message par CRM lead. Attachment-only DM ka text khali hota hai,
  // to wo apne aap skip ho jata hai. Ye kabhi throw nahi karta.
  await maybeCreateSocialLead({
    organizationId,
    contactId: contact.id,
    conversationId: conversation.id,
    channel: 'INSTAGRAM',
    text,
  });

  // Returned so the webhook can honour human handoff (skip automation when paused).
  return updatedConversation;
};

/**
 * Send an agent's reply to an Instagram conversation and record it. Scoped by
 * org so an id from another tenant matches nothing.
 */
export const sendInstagramMessage = async (organizationId: string, conversationId: string, text: string) => {
  const body = (text || '').trim();
  if (!body) throw new Error('Message text is required');

  const conversation = await prisma.conversation.findFirst({
    where: { id: conversationId, organizationId, channel: 'INSTAGRAM' },
    include: { contact: true },
  });
  if (!conversation || !conversation.instagramAccountId || !conversation.contact?.instagramUserId) {
    throw new Error('Instagram conversation not found');
  }

  const account = await prisma.instagramAccount.findFirst({
    where: { id: conversation.instagramAccountId, organizationId },
  });
  if (!account) throw new Error('Instagram account not found for this conversation');

  // Token is stored as issued by Meta (long-lived). Used server-side only.
  const sent = await sendIGMessage(igAccessToken(account.accessToken), conversation.contact.instagramUserId, body);

  const message = await prisma.message.create({
    data: {
      conversationId: conversation.id,
      channel: 'INSTAGRAM',
      direction: 'OUTBOUND',
      type: 'TEXT',
      content: body,
      metadata: sent?.message_id ? { igMessageId: sent.message_id } : undefined,
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

  webhookEvents.emit('newMessage', { organizationId, conversationId: conversation.id, message, conversation: updatedConversation });
  webhookEvents.emit('conversationUpdated', { organizationId, conversation: updatedConversation });

  return message;
};

/** Unified-inbox Instagram analytics (mirrors the Telegram dashboard). */
export const getInboxStats = async (organizationId: string, rangeDays = 7) => {
  // Only the ranges the dashboard offers, so the interval is never built from
  // arbitrary user input.
  const span = [7, 14, 30].includes(Number(rangeDays)) ? Number(rangeDays) : 7;
  const tgConv = { organizationId };
  const [
    accounts, conversations, contacts, inbound, outbound,
    automations, triggered, dmRules, commentRules, storyRules, dailyRows,
  ] = await Promise.all([
    prisma.instagramAccount.count({ where: { organizationId, isActive: true } }),
    prisma.conversation.count({ where: { organizationId, channel: 'INSTAGRAM' } }),
    prisma.contact.count({ where: { organizationId, instagramUserId: { not: null } } }),
    prisma.message.count({ where: { channel: 'INSTAGRAM', direction: 'INBOUND', conversation: tgConv } }),
    prisma.message.count({ where: { channel: 'INSTAGRAM', direction: 'OUTBOUND', conversation: tgConv } }),
    prisma.igDmAutomation.count({ where: { organizationId } }),
    prisma.igDmAutomation.aggregate({ where: { organizationId }, _sum: { repliesCount: true } }),
    // Real "top rules", drawn from all three Instagram automation types.
    prisma.igDmAutomation.findMany({
      where: { organizationId },
      select: { id: true, name: true, repliesCount: true },
      orderBy: { repliesCount: 'desc' },
      take: 5,
    }),
    prisma.igCommentRule.findMany({
      where: { organizationId },
      select: { id: true, name: true, triggeredCount: true },
      orderBy: { triggeredCount: 'desc' },
      take: 5,
    }),
    prisma.igStoryRule.findMany({
      where: { organizationId },
      select: { id: true, name: true, triggeredCount: true, triggerType: true },
      orderBy: { triggeredCount: 'desc' },
      take: 5,
    }),
    prisma.$queryRaw<Array<{ day: Date; direction: string; count: bigint }>>`
      SELECT date_trunc('day', m."timestamp") AS day, m.direction AS direction, COUNT(*)::int AS count
      FROM "Message" m JOIN "Conversation" c ON c.id = m."conversationId"
      WHERE c."organizationId" = ${organizationId} AND m.channel = 'INSTAGRAM'
        AND m."timestamp" >= NOW() - MAKE_INTERVAL(days => ${span}::int)
      GROUP BY 1, 2
    `,
  ]);

  const days: { date: string; label: string; inbound: number; outbound: number }[] = [];
  const index: Record<string, number> = {};
  for (let i = span - 1; i >= 0; i--) {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    index[key] = days.length;
    // Weekday names only read well on a week; longer ranges use day/month.
    const label = span <= 7
      ? d.toLocaleDateString('en-IN', { weekday: 'short' })
      : d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
    days.push({ date: key, label, inbound: 0, outbound: 0 });
  }
  for (const row of dailyRows) {
    const slot = index[new Date(row.day).toISOString().slice(0, 10)];
    if (slot === undefined) continue;
    const n = Number(row.count);
    if (row.direction === 'INBOUND') days[slot].inbound += n;
    else days[slot].outbound += n;
  }

  // Merge the three rule types into one ranked list.
  const topRules = [
    ...dmRules.map((r) => ({ id: r.id, name: r.name, triggerType: 'DM', count: r.repliesCount || 0 })),
    ...commentRules.map((r) => ({ id: r.id, name: r.name, triggerType: 'COMMENT', count: r.triggeredCount || 0 })),
    ...storyRules.map((r) => ({ id: r.id, name: r.name, triggerType: 'STORY', count: r.triggeredCount || 0 })),
  ]
    .filter((r) => r.count > 0)
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  const storyTriggered = storyRules.reduce((acc, r) => acc + (r.triggeredCount || 0), 0);
  const commentTriggered = commentRules.reduce((acc, r) => acc + (r.triggeredCount || 0), 0);

  return {
    accounts,
    conversations,
    contacts,
    rangeDays: span,
    messages: { inbound, outbound, total: inbound + outbound },
    automations: { rules: automations, triggered: triggered._sum.repliesCount || 0 },
    storyTriggered,
    commentTriggered,
    topRules,
    daily: days,
  };
};

/** Stream an inbound Instagram media message through the backend proxy. */
export const streamMedia = async (organizationId: string, messageId: string) => {
  const message = await prisma.message.findFirst({
    where: { id: messageId, channel: 'INSTAGRAM', conversation: { organizationId } },
  });
  const url = (message?.metadata as any)?.igMediaUrl;
  if (!message || !url) throw new Error('Media not found');

  const download = await axios.get(url, { responseType: 'stream', timeout: 60000 });
  return {
    stream: download.data as NodeJS.ReadableStream,
    contentType: message.mediaMimeType || download.headers['content-type'] || 'application/octet-stream',
  };
};

/**
 * Send a media attachment to an Instagram conversation. `mediaUrl` must be a
 * publicly reachable URL (Meta fetches it) — the inbox uploads via the shared
 * media store first, then passes that URL here.
 */
export const sendInstagramMedia = async (
  organizationId: string,
  conversationId: string,
  mediaUrl: string,
  mediaType?: string
) => {
  if (!mediaUrl) throw new Error('mediaUrl is required');

  const conversation = await prisma.conversation.findFirst({
    where: { id: conversationId, organizationId, channel: 'INSTAGRAM' },
    include: { contact: true },
  });
  if (!conversation || !conversation.instagramAccountId || !conversation.contact?.instagramUserId) {
    throw new Error('Instagram conversation not found');
  }
  const account = await prisma.instagramAccount.findFirst({ where: { id: conversation.instagramAccountId, organizationId } });
  if (!account) throw new Error('Instagram account not found for this conversation');

  const mime = (mediaType || '').toLowerCase();
  const igType: 'image' | 'video' | 'audio' = mime.startsWith('video') ? 'video' : mime.startsWith('audio') ? 'audio' : 'image';
  const msgType = igType === 'video' ? 'VIDEO' : igType === 'audio' ? 'AUDIO' : 'IMAGE';

  const sent = await sendIGAttachment(igAccessToken(account.accessToken), conversation.contact.instagramUserId, igType, mediaUrl);

  const message = await prisma.message.create({
    data: {
      conversationId: conversation.id,
      channel: 'INSTAGRAM',
      direction: 'OUTBOUND',
      type: msgType,
      mediaUrl,
      mediaType: mediaType || null,
      mediaMimeType: mediaType || null,
      metadata: sent?.message_id ? { igMessageId: sent.message_id } : undefined,
      status: 'SENT',
      sentAt: new Date(),
      timestamp: new Date(),
    },
  });

  const updatedConversation = await prisma.conversation.update({
    where: { id: conversation.id },
    data: { lastMessageAt: new Date(), lastMessagePreview: '📎 Attachment' },
    include: { contact: true },
  });

  webhookEvents.emit('newMessage', { organizationId, conversationId: conversation.id, message, conversation: updatedConversation });
  webhookEvents.emit('conversationUpdated', { organizationId, conversation: updatedConversation });

  return message;
};

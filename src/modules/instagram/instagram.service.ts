import prisma from '../../config/database';
import { IgTriggerType, IgAccountStatus } from '@prisma/client';
import axios from 'axios';
import { getAccountMedia, getAccountStories, subscribePageToApp } from './instagram.api';
import { encrypt, safeDecrypt, isEncrypted } from '../../utils/encryption';
import { AppError } from '../../middleware/errorHandler';


/**
 * Read an Instagram account's token. Rows created before tokens were encrypted
 * still hold plaintext, so fall back to the raw value when it isn't encrypted.
 */
export const igAccessToken = (raw: string | null | undefined): string => {
  if (!raw) return '';
  return isEncrypted(raw) ? (safeDecrypt(raw) || '') : raw;
};

/**
 * Organization ke saare Instagram accounts fetch karna
 */
export const getOrganizationAccounts = async (organizationId: string) => {
  const accounts = await prisma.instagramAccount.findMany({
    where: { organizationId },
    include: {
      _count: {
        select: {
          dmAutomations: true,
          commentRules: true
        }
      }
    }
  });
  // The access token must never reach the browser.
  return accounts.map(({ accessToken, ...safe }) => safe);
};

/**
 * Disconnect an Instagram account: clear the stored token and mark it inactive.
 * The row is kept so existing conversations and messages stay intact.
 */
export const disconnectAccount = async (organizationId: string, accountId: string) => {
  const account = await prisma.instagramAccount.findFirst({
    where: { id: accountId, organizationId },
  });
  if (!account) return null;

  await prisma.instagramAccount.update({
    where: { id: account.id },
    data: { accessToken: '', status: 'DISCONNECTED' as IgAccountStatus, isActive: false },
  });
  return { id: account.id, username: account.username };
};

/**
 * Naya Instagram Account save ya update karna (OAuth ke baad)
 */
export const saveInstagramAccount = async (organizationId: string, data: any) => {
  return await prisma.instagramAccount.upsert({
    where: { igUserId: data.igUserId },
    update: {
      username: data.username,
      name: data.name,
      accessToken: encrypt(data.accessToken),
      profilePicUrl: data.profilePicUrl,
      status: 'CONNECTED',
      isActive: true,
      lastSyncedAt: new Date()
    },
    create: {
      organizationId,
      igUserId: data.igUserId,
      username: data.username,
      name: data.name,
      accessToken: encrypt(data.accessToken),
      profilePicUrl: data.profilePicUrl,
      status: 'CONNECTED'
    }
  });
};

/**
 * DM Automation Rules fetch karna
 */
export const getDmAutomations = async (organizationId: string) => {
  return await prisma.igDmAutomation.findMany({
    where: { organizationId },
    orderBy: { createdAt: 'desc' }
  });
};

/**
 * DM Automation Rule create karna
 */
export const createDmAutomation = async (organizationId: string, data: any) => {
  // Pehle check karein ki account exist karta hai
  const account = await prisma.instagramAccount.findFirst({
    where: { organizationId, isActive: true }
  });

  if (!account) throw new AppError('Connect an Instagram account first to use this feature.', 400);

  return await prisma.igDmAutomation.create({
    data: {
      organizationId,
      igAccountId: account.id,
      name: data.name,
      triggerType: data.triggerType as IgTriggerType,
      keywords: data.keywords || [],
      matchType: data.matchType || 'contains',
      responseText: data.responseText,
      isActive: true
    }
  });
};

/**
 * Status toggle karna (Active/Paused)
 */
export const updateDmStatus = async (
  id: string,
  organizationId: string,
  isActive: boolean
) => {
  // updateMany so a rule belonging to another organization simply matches
  // nothing rather than being toggled.
  const result = await prisma.igDmAutomation.updateMany({
    where: { id, organizationId },
    data: { isActive }
  });

  if (result.count === 0) return null;

  return await prisma.igDmAutomation.findFirst({
    where: { id, organizationId }
  });
};

/** Delete a DM automation rule. Org-scoped so another tenant's id matches nothing. */
export const deleteDmAutomation = async (id: string, organizationId: string) => {
  const result = await prisma.igDmAutomation.deleteMany({ where: { id, organizationId } });
  return result.count > 0 ? { id } : null;
};

// ── Content: the connected account's posts + active stories ────────────────

export const getContent = async (organizationId: string) => {
  const account = await prisma.instagramAccount.findFirst({ where: { organizationId, isActive: true } });
  if (!account) return { connected: false, account: null, posts: [], stories: [] };

  const [posts, stories] = await Promise.all([
    getAccountMedia(igAccessToken(account.accessToken), account.igUserId, 30).catch(() => []),
    getAccountStories(igAccessToken(account.accessToken), account.igUserId).catch(() => []),
  ]);

  return {
    connected: true,
    account: { username: account.username, name: account.name, profilePicUrl: account.profilePicUrl },
    posts,
    stories,
  };
};

// ── Story rules (auto-reply to story mentions / replies) ───────────────────

export const getStoryRules = (organizationId: string) =>
  prisma.igStoryRule.findMany({ where: { organizationId }, orderBy: { createdAt: 'desc' } });

export const createStoryRule = async (organizationId: string, data: any) => {
  const account = await prisma.instagramAccount.findFirst({ where: { organizationId, isActive: true } });
  if (!account) throw new AppError('Connect an Instagram account first to use this feature.', 400);
  return prisma.igStoryRule.create({
    data: {
      organizationId,
      igAccountId: account.id,
      name: data.name || (data.triggerType === 'reply' ? 'Story reply' : 'Story mention'),
      triggerType: data.triggerType === 'reply' ? 'reply' : 'mention',
      dmMessage: String(data.dmMessage || ''),
      isActive: true,
    },
  });
};

export const toggleStoryRule = async (id: string, organizationId: string, isActive: boolean) => {
  const result = await prisma.igStoryRule.updateMany({ where: { id, organizationId }, data: { isActive } });
  if (result.count === 0) return null;
  return prisma.igStoryRule.findFirst({ where: { id, organizationId } });
};

export const deleteStoryRule = async (id: string, organizationId: string) => {
  const result = await prisma.igStoryRule.deleteMany({ where: { id, organizationId } });
  return result.count > 0 ? { id } : null;
};

/** Webhook helper: the active story rule for this account + trigger, if any. */
export const findMatchingStoryRule = (igUserId: string, triggerType: 'mention' | 'reply') =>
  prisma.igStoryRule.findFirst({
    where: { igAccount: { igUserId }, isActive: true, triggerType },
  });

/**
 * Comment Rules fetch karna
 */
export const getCommentRules = async (organizationId: string) => {
  return await prisma.igCommentRule.findMany({
    where: { organizationId },
    orderBy: { createdAt: 'desc' }
  });
};

export const createCommentRule = async (organizationId: string, data: any) => {
  const account = await prisma.instagramAccount.findFirst({ where: { organizationId, isActive: true } });
  if (!account) throw new AppError('Connect an Instagram account first to use this feature.', 400);
  return prisma.igCommentRule.create({
    data: {
      organizationId,
      igAccountId: account.id,
      name: data.name || 'Comment rule',
      keywords: Array.isArray(data.keywords) ? data.keywords.map((k: any) => String(k).toLowerCase().trim()).filter(Boolean) : [],
      postIds: Array.isArray(data.postIds) ? data.postIds.filter(Boolean) : [],
      action: data.action || 'reply_and_dm',
      commentReply: data.commentReply ? String(data.commentReply) : null,
      dmMessage: data.dmMessage ? String(data.dmMessage) : null,
      isActive: true,
    },
  });
};

export const toggleCommentRule = async (id: string, organizationId: string, isActive: boolean) => {
  const result = await prisma.igCommentRule.updateMany({ where: { id, organizationId }, data: { isActive } });
  if (result.count === 0) return null;
  return prisma.igCommentRule.findFirst({ where: { id, organizationId } });
};

export const deleteCommentRule = async (id: string, organizationId: string) => {
  const result = await prisma.igCommentRule.deleteMany({ where: { id, organizationId } });
  return result.count > 0 ? { id } : null;
};

/**
 * Analytics Data fetch karna (Dashboard ke liye)
 */
export const getGlobalIgStats = async (organizationId: string) => {
  const stats = await prisma.igAnalytics.findMany({
    where: {
      igAccount: { organizationId }
    },
    orderBy: { date: 'desc' },
    take: 30
  });

  // Aggregate totals
  const totals = await prisma.igAnalytics.aggregate({
    where: {
      igAccount: { organizationId }
    },
    _sum: {
      dmsSent: true,
      commentsReplied: true,
      automationReplies: true
    }
  });

  return {
    history: stats,
    totals: totals._sum
  };
};

/**
 * Webhook Trigger: Jab koi DM aaye toh matching automation dhoondhna
 */
export const findMatchingAutomation = async (igUserId: string, messageText: string) => {
  const text = messageText.toLowerCase().trim();

  return await prisma.igDmAutomation.findFirst({
    where: {
      igAccount: { igUserId },
      isActive: true,
      triggerType: 'KEYWORD',
      OR: [
        {
          keywords: {
            has: text
          }
        }
      ]
    }
  });
};

/**
 * Short-lived token ko Long-lived token mein badalna
 */
export const exchangeForLongLivedToken = async (shortToken: string) => {
  const response = await axios.get(`https://graph.facebook.com/v19.0/oauth/access_token`, {
    params: {
      grant_type: 'fb_exchange_token',
      client_id: process.env.META_APP_ID,
      client_secret: process.env.META_APP_SECRET,
      fb_exchange_token: shortToken
    }
  });
  return response.data.access_token;
};

/**
 * User ke saare Pages aur unse linked Instagram accounts fetch karna
 */
export const syncInstagramAccounts = async (organizationId: string, longToken: string) => {
  // 1. Get the user's Pages. Each page carries its own access_token, which is
  //    what Instagram messaging and comment replies actually require.
  const pagesRes = await axios.get(`https://graph.facebook.com/v19.0/me/accounts`, {
    params: { access_token: longToken }
  });

  const pages = pagesRes.data.data || [];
  const linked: { igUserId: string; username?: string; subscribed: boolean }[] = [];

  for (const page of pages) {
    // A page token derived from a long-lived user token does not expire, so it
    // survives far longer than the 60-day user token we used to store.
    const pageToken: string = page.access_token || longToken;
    // 2. Check if Page has a linked Instagram Business Account
    const igRes = await axios.get(`https://graph.facebook.com/v19.0/${page.id}`, {
      params: {
        fields: 'instagram_business_account,name',
        access_token: pageToken
      }
    });

    const igAccount = igRes.data.instagram_business_account;

    if (igAccount) {
      // 3. Get Instagram Account Details
      const details = await axios.get(`https://graph.facebook.com/v19.0/${igAccount.id}`, {
        params: {
          fields: 'username,name,profile_picture_url,followers_count',
          access_token: pageToken
        }
      });

      // 4. Save the PAGE token, encrypted at rest.
      await prisma.instagramAccount.upsert({
        where: { igUserId: igAccount.id },
        update: {
          accessToken: encrypt(pageToken),
          username: details.data.username,
          name: details.data.name,
          profilePicUrl: details.data.profile_picture_url,
          pageId: page.id,
          status: 'CONNECTED',
          isActive: true,
          lastSyncedAt: new Date()
        },
        create: {
          organizationId,
          igUserId: igAccount.id,
          username: details.data.username,
          name: details.data.name,
          accessToken: encrypt(pageToken),
          status: 'CONNECTED',
          pageId: page.id
        }
      });

      // 5. Subscribe the page to this app. Without this Meta never delivers a
      //    single Instagram webhook, so no automation could ever fire.
      let subscribed = false;
      try {
        subscribed = await subscribePageToApp(pageToken, page.id);
      } catch (err: any) {
        console.error(
          `[instagram] Failed to subscribe page ${page.id} for webhooks:`,
          err?.response?.data?.error?.message || err?.message
        );
      }

      linked.push({ igUserId: igAccount.id, username: details.data.username, subscribed });
    }
  }

  return linked;
};

import prisma from '../../config/database';
import { IgTriggerType, IgAccountStatus } from '@prisma/client';
import axios from 'axios';

/**
 * Organization ke saare Instagram accounts fetch karna
 */
export const getOrganizationAccounts = async (organizationId: string) => {
  return await prisma.instagramAccount.findMany({
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
      accessToken: data.accessToken, // Encrypt this in production
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
      accessToken: data.accessToken,
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

  if (!account) throw new Error('No active Instagram account found for this organization');

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
export const updateDmStatus = async (id: string, isActive: boolean) => {
  return await prisma.igDmAutomation.update({
    where: { id },
    data: { isActive }
  });
};

/**
 * Comment Rules fetch karna
 */
export const getCommentRules = async (organizationId: string) => {
  return await prisma.igCommentRule.findMany({
    where: { organizationId },
    orderBy: { createdAt: 'desc' }
  });
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
  // 1. Get User's Pages
  const pagesRes = await axios.get(`https://graph.facebook.com/v19.0/me/accounts`, {
    params: { access_token: longToken }
  });

  const pages = pagesRes.data.data;

  for (const page of pages) {
    // 2. Check if Page has a linked Instagram Business Account
    const igRes = await axios.get(`https://graph.facebook.com/v19.0/${page.id}`, {
      params: { 
        fields: 'instagram_business_account,name',
        access_token: longToken 
      }
    });

    const igAccount = igRes.data.instagram_business_account;

    if (igAccount) {
      // 3. Get Instagram Account Details
      const details = await axios.get(`https://graph.facebook.com/v19.0/${igAccount.id}`, {
        params: { 
          fields: 'username,name,profile_picture_url,followers_count',
          access_token: longToken 
        }
      });

      // 4. Save to Database
      await prisma.instagramAccount.upsert({
        where: { igUserId: igAccount.id },
        update: {
          accessToken: longToken, // Simplified: ideally store page token or system user token
          username: details.data.username,
          profilePicUrl: details.data.profile_picture_url,
          status: 'CONNECTED',
          isActive: true
        },
        create: {
          organizationId,
          igUserId: igAccount.id,
          username: details.data.username,
          name: details.data.name,
          accessToken: longToken,
          status: 'CONNECTED',
          pageId: page.id
        }
      });
    }
  }
};

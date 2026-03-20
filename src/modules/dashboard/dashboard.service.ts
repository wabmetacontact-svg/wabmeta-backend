// src/modules/dashboard/dashboard.service.ts - COMPLETE WITH CHARTS DATA

import prisma from '../../config/database';

export class DashboardService {
  // ============================================
  // GET DASHBOARD STATS
  // ============================================

  async getStats(organizationId: string) {
    try {
      const now = new Date();
      const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const startOfWeek = new Date(now);
      startOfWeek.setDate(now.getDate() - 7);
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);

      // Parallel queries for performance
      const [
        // Contacts
        totalContacts,
        newContactsToday,
        newContactsThisWeek,
        newContactsThisMonth,
        newContactsLastMonth,

        // Messages
        totalMessagesSent,
        totalMessagesReceived,
        messagesToday,
        messagesThisWeek,
        messagesThisMonth,
        messagesLastMonth,

        // Delivery stats
        deliveredMessages,
        readMessages,
        failedMessages,

        // Conversations
        totalConversations,
        activeConversations,
        unreadConversations,

        // Campaigns
        totalCampaigns,
        activeCampaigns,
        completedCampaigns,
        campaignsThisMonth,

        // Templates
        totalTemplates,
        approvedTemplates,

        // WhatsApp Accounts
        connectedAccounts,
      ] = await Promise.all([
        // Contacts
        prisma.contact.count({ where: { organizationId } }),
        prisma.contact.count({ where: { organizationId, createdAt: { gte: startOfToday } } }),
        prisma.contact.count({ where: { organizationId, createdAt: { gte: startOfWeek } } }),
        prisma.contact.count({ where: { organizationId, createdAt: { gte: startOfMonth } } }),
        prisma.contact.count({ where: { organizationId, createdAt: { gte: startOfLastMonth, lte: endOfLastMonth } } }),

        // Messages sent
        prisma.message.count({ where: { conversation: { organizationId }, direction: 'OUTBOUND' } }),
        prisma.message.count({ where: { conversation: { organizationId }, direction: 'INBOUND' } }),
        prisma.message.count({ where: { conversation: { organizationId }, direction: 'OUTBOUND', createdAt: { gte: startOfToday } } }),
        prisma.message.count({ where: { conversation: { organizationId }, direction: 'OUTBOUND', createdAt: { gte: startOfWeek } } }),
        prisma.message.count({ where: { conversation: { organizationId }, direction: 'OUTBOUND', createdAt: { gte: startOfMonth } } }),
        prisma.message.count({ where: { conversation: { organizationId }, direction: 'OUTBOUND', createdAt: { gte: startOfLastMonth, lte: endOfLastMonth } } }),

        // Delivery stats
        prisma.message.count({ where: { conversation: { organizationId }, direction: 'OUTBOUND', status: { in: ['DELIVERED', 'READ'] } } }),
        prisma.message.count({ where: { conversation: { organizationId }, direction: 'OUTBOUND', status: 'READ' } }),
        prisma.message.count({ where: { conversation: { organizationId }, direction: 'OUTBOUND', status: 'FAILED' } }),

        // Conversations
        prisma.conversation.count({ where: { organizationId } }),
        prisma.conversation.count({ where: { organizationId, isWindowOpen: true } }),
        prisma.conversation.count({ where: { organizationId, unreadCount: { gt: 0 } } }),

        // Campaigns
        prisma.campaign.count({ where: { organizationId } }),
        prisma.campaign.count({ where: { organizationId, status: 'RUNNING' } }),
        prisma.campaign.count({ where: { organizationId, status: 'COMPLETED' } }),
        prisma.campaign.count({ where: { organizationId, createdAt: { gte: startOfMonth } } }),

        // Templates
        prisma.template.count({ where: { organizationId } }),
        prisma.template.count({ where: { organizationId, status: 'APPROVED' } }),

        // WhatsApp accounts
        prisma.whatsAppAccount.count({ where: { organizationId, status: 'CONNECTED' } }),
      ]);

      // Calculate growth percentages
      const contactsGrowth = newContactsLastMonth > 0
        ? Math.round(((newContactsThisMonth - newContactsLastMonth) / newContactsLastMonth) * 100)
        : newContactsThisMonth > 0 ? 100 : 0;

      const messagesGrowth = messagesLastMonth > 0
        ? Math.round(((messagesThisMonth - messagesLastMonth) / messagesLastMonth) * 100)
        : messagesThisMonth > 0 ? 100 : 0;

      // Calculate rates
      const deliveryRate = totalMessagesSent > 0
        ? Math.round((deliveredMessages / totalMessagesSent) * 100)
        : 0;

      const readRate = deliveredMessages > 0
        ? Math.round((readMessages / deliveredMessages) * 100)
        : 0;

      const failureRate = totalMessagesSent > 0
        ? Math.round((failedMessages / totalMessagesSent) * 100)
        : 0;

      return {
        contacts: {
          total: totalContacts,
          today: newContactsToday,
          thisWeek: newContactsThisWeek,
          thisMonth: newContactsThisMonth,
          growth: contactsGrowth,
        },
        messages: {
          sent: totalMessagesSent,
          received: totalMessagesReceived,
          total: totalMessagesSent + totalMessagesReceived,
          today: messagesToday,
          thisWeek: messagesThisWeek,
          thisMonth: messagesThisMonth,
          growth: messagesGrowth,
        },
        delivery: {
          delivered: deliveredMessages,
          read: readMessages,
          failed: failedMessages,
          deliveryRate,
          readRate,
          failureRate,
        },
        conversations: {
          total: totalConversations,
          active: activeConversations,
          unread: unreadConversations,
        },
        campaigns: {
          total: totalCampaigns,
          active: activeCampaigns,
          completed: completedCampaigns,
          thisMonth: campaignsThisMonth,
        },
        templates: {
          total: totalTemplates,
          approved: approvedTemplates,
        },
        whatsapp: {
          connected: connectedAccounts,
        },
      };
    } catch (error) {
      console.error('getDashboardStats error:', error);
      throw error;
    }
  }

  // ============================================
  // GET DASHBOARD WIDGETS (CHARTS DATA)
  // ============================================

  async getWidgets(organizationId: string, days: number = 7) {
    try {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);
      startDate.setHours(0, 0, 0, 0);

      // Get messages for chart
      const messages = await prisma.message.findMany({
        where: {
          conversation: { organizationId },
          createdAt: { gte: startDate },
        },
        select: {
          direction: true,
          status: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'asc' },
      });

      // Get contacts for chart
      const contacts = await prisma.contact.findMany({
        where: {
          organizationId,
          createdAt: { gte: startDate },
        },
        select: {
          createdAt: true,
        },
        orderBy: { createdAt: 'asc' },
      });

      // Process messages by date
      const messagesByDate: Record<string, {
        date: string;
        sent: number;
        delivered: number;
        read: number;
        failed: number;
        received: number;
      }> = {};

      // Initialize all days
      for (let i = 0; i <= days; i++) {
        const date = new Date();
        date.setDate(date.getDate() - (days - i));
        const dateKey = date.toISOString().split('T')[0];
        messagesByDate[dateKey] = {
          date: dateKey,
          sent: 0,
          delivered: 0,
          read: 0,
          failed: 0,
          received: 0,
        };
      }

      // Fill in actual data
      messages.forEach((msg) => {
        const dateKey = msg.createdAt.toISOString().split('T')[0];
        if (!messagesByDate[dateKey]) {
          messagesByDate[dateKey] = {
            date: dateKey,
            sent: 0,
            delivered: 0,
            read: 0,
            failed: 0,
            received: 0,
          };
        }

        if (msg.direction === 'OUTBOUND') {
          messagesByDate[dateKey].sent++;
          if (msg.status === 'DELIVERED') messagesByDate[dateKey].delivered++;
          if (msg.status === 'READ') {
            messagesByDate[dateKey].delivered++;
            messagesByDate[dateKey].read++;
          }
          if (msg.status === 'FAILED') messagesByDate[dateKey].failed++;
        } else {
          messagesByDate[dateKey].received++;
        }
      });

      // Process contacts by date
      const contactsByDate: Record<string, { date: string; count: number }> = {};

      // Initialize all days
      for (let i = 0; i <= days; i++) {
        const date = new Date();
        date.setDate(date.getDate() - (days - i));
        const dateKey = date.toISOString().split('T')[0];
        contactsByDate[dateKey] = { date: dateKey, count: 0 };
      }

      contacts.forEach((contact) => {
        const dateKey = contact.createdAt.toISOString().split('T')[0];
        if (!contactsByDate[dateKey]) {
          contactsByDate[dateKey] = { date: dateKey, count: 0 };
        }
        contactsByDate[dateKey].count++;
      });

      // Convert to arrays sorted by date
      const messagesOverview = Object.values(messagesByDate).sort(
        (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
      );
      const contactsGrowth = Object.values(contactsByDate).sort(
        (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
      );

      // Calculate delivery performance - Optimized for unique counts
      // Sent: Anything successfully handled by Meta (Sent, Delivered, Read)
      const totalSentActual = messages.filter(
        (m) => m.direction === 'OUTBOUND' && ['SENT', 'DELIVERED', 'READ'].includes(m.status)
      ).length;

      const totalDeliveredOnly = messages.filter(
        (m) => m.direction === 'OUTBOUND' && m.status === 'DELIVERED'
      ).length;

      const totalRead = messages.filter(
        (m) => m.direction === 'OUTBOUND' && m.status === 'READ'
      ).length;

      const totalFailed = messages.filter(
        (m) => m.direction === 'OUTBOUND' && m.status === 'FAILED'
      ).length;

      // Current chart shows Outcome breakdown (Summed unique categories)
      // Total Unique = (Delivered Only) + Read + Failed
      const deliveryPerformance = [
        { name: 'Delivered', value: totalDeliveredOnly, color: '#22c55e' },
        { name: 'Read', value: totalRead, color: '#3b82f6' },
        { name: 'Failed', value: totalFailed, color: '#ef4444' },
      ];

      // Recent campaigns
      const recentCampaigns = await prisma.campaign.findMany({
        where: { organizationId },
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: {
          id: true,
          name: true,
          status: true,
          totalContacts: true,
          sentCount: true,
          deliveredCount: true,
          readCount: true,
          failedCount: true,
          createdAt: true,
        },
      });

      // Recent conversations
      const recentConversations = await prisma.conversation.findMany({
        where: { organizationId },
        orderBy: { lastMessageAt: 'desc' },
        take: 5,
        include: {
          contact: {
            select: {
              firstName: true,
              lastName: true,
              phone: true,
              avatar: true,
            },
          },
        },
      });

      return {
        messagesOverview,
        contactsGrowth,
        deliveryPerformance,
        recentCampaigns: recentCampaigns.map((c) => ({
          ...c,
          deliveryRate: c.sentCount > 0 ? Math.round((c.deliveredCount / c.sentCount) * 100) : 0,
        })),
        recentConversations: recentConversations.map((conv) => ({
          id: conv.id,
          contactName: [conv.contact.firstName, conv.contact.lastName].filter(Boolean).join(' ') || conv.contact.phone,
          phone: conv.contact.phone,
          avatar: conv.contact.avatar,
          lastMessage: conv.lastMessagePreview,
          lastMessageAt: conv.lastMessageAt,
          unreadCount: conv.unreadCount,
        })),
        summary: {
          totalSent: totalSentActual,
          totalDelivered: totalDeliveredOnly + totalRead,
          totalRead,
          totalFailed,
          deliveryRate: totalSentActual > 0 ? Math.round(((totalDeliveredOnly + totalRead) / totalSentActual) * 100) : 0,
          readRate: (totalDeliveredOnly + totalRead) > 0 ? Math.round((totalRead / (totalDeliveredOnly + totalRead)) * 100) : 0,
        },
      };
    } catch (error) {
      console.error('getDashboardWidgets error:', error);
      throw error;
    }
  }

  // ============================================
  // GET RECENT ACTIVITY
  // ============================================

  async getActivity(organizationId: string, limit: number = 10) {
    try {
      const activities = await prisma.activityLog.findMany({
        where: { organizationId },
        orderBy: { createdAt: 'desc' },
        take: limit,
        include: {
          user: {
            select: {
              firstName: true,
              lastName: true,
              email: true,
              avatar: true,
            },
          },
        },
      });

      return activities.map((activity) => ({
        id: activity.id,
        action: activity.action,
        entity: activity.entity,
        entityId: activity.entityId,
        user: activity.user
          ? {
            name: [activity.user.firstName, activity.user.lastName].filter(Boolean).join(' ') || activity.user.email,
            avatar: activity.user.avatar,
          }
          : null,
        metadata: activity.metadata,
        createdAt: activity.createdAt,
      }));
    } catch (error) {
      console.error('getDashboardActivity error:', error);
      throw error;
    }
  }
}

export const dashboardService = new DashboardService();
export default dashboardService;
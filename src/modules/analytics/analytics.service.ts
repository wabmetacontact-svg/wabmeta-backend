// src/modules/analytics/analytics.service.ts

import { PrismaClient, MessageStatus, CampaignStatus } from '@prisma/client';
import prisma from '../../config/database';

export class AnalyticsService {
    // ============================================
    // OVERVIEW STATS
    // ============================================

    async getOverviewStats(organizationId: string, dateRange?: { start: Date; end: Date }) {
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);

        const start = dateRange?.start || startOfMonth;
        const end = dateRange?.end || now;

        // Current period stats
        const [
            totalContacts,
            newContactsThisPeriod,
            newContactsLastPeriod,
            totalConversations,
            unreadConversations,
            totalMessagesSent,
            totalMessagesReceived,
            messagesThisPeriod,
            messagesLastPeriod,
            totalCampaigns,
            activeCampaigns,
            completedCampaigns,
            totalTemplates,
            approvedTemplates,
        ] = await Promise.all([
            // Contacts
            prisma.contact.count({ where: { organizationId } }),
            prisma.contact.count({
                where: { organizationId, createdAt: { gte: start, lte: end } },
            }),
            prisma.contact.count({
                where: { organizationId, createdAt: { gte: startOfLastMonth, lte: endOfLastMonth } },
            }),

            // Conversations
            prisma.conversation.count({ where: { organizationId } }),
            prisma.conversation.count({ where: { organizationId, isRead: false } }),

            // Messages
            prisma.message.count({
                where: { conversation: { organizationId }, direction: 'OUTBOUND' },
            }),
            prisma.message.count({
                where: { conversation: { organizationId }, direction: 'INBOUND' },
            }),
            prisma.message.count({
                where: {
                    conversation: { organizationId },
                    direction: 'OUTBOUND',
                    createdAt: { gte: start, lte: end },
                },
            }),
            prisma.message.count({
                where: {
                    conversation: { organizationId },
                    direction: 'OUTBOUND',
                    createdAt: { gte: startOfLastMonth, lte: endOfLastMonth },
                },
            }),

            // Campaigns
            prisma.campaign.count({ where: { organizationId } }),
            prisma.campaign.count({ where: { organizationId, status: CampaignStatus.RUNNING } }),
            prisma.campaign.count({ where: { organizationId, status: CampaignStatus.COMPLETED } }),

            // Templates
            prisma.template.count({ where: { organizationId } }),
            prisma.template.count({ where: { organizationId, status: 'APPROVED' } }),
        ]);

        // Calculate growth percentages
        const contactsGrowth = newContactsLastPeriod > 0
            ? Math.round(((newContactsThisPeriod - newContactsLastPeriod) / newContactsLastPeriod) * 100)
            : newContactsThisPeriod > 0 ? 100 : 0;

        const messagesGrowth = messagesLastPeriod > 0
            ? Math.round(((messagesThisPeriod - messagesLastPeriod) / messagesLastPeriod) * 100)
            : messagesThisPeriod > 0 ? 100 : 0;

        return {
            contacts: {
                total: totalContacts,
                newThisPeriod: newContactsThisPeriod,
                growth: contactsGrowth,
            },
            conversations: {
                total: totalConversations,
                unread: unreadConversations,
            },
            messages: {
                sent: totalMessagesSent,
                received: totalMessagesReceived,
                total: totalMessagesSent + totalMessagesReceived,
                thisPeriod: messagesThisPeriod,
                growth: messagesGrowth,
            },
            campaigns: {
                total: totalCampaigns,
                active: activeCampaigns,
                completed: completedCampaigns,
            },
            templates: {
                total: totalTemplates,
                approved: approvedTemplates,
            },
        };
    }

    async getUnifiedDashboardStats(organizationId: string, days: number = 30) {
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);

        // 1. WhatsApp Stats
        const waStats = await prisma.message.count({
            where: {
                conversation: { organizationId },
                createdAt: { gte: startDate },
                direction: 'OUTBOUND'
            }
        });

        // 2. Instagram Stats
        const igStats = await prisma.igAnalytics.aggregate({
            where: {
                igAccount: { organizationId },
                date: { gte: startDate }
            },
            _sum: {
                dmsSent: true,
                automationReplies: true,
                commentsReplied: true
            }
        });

        // 3. Channel-wise Contacts Growth
        const waContacts = await prisma.contact.count({
            where: { organizationId, source: 'WHATSAPP' }
        });
        
        const igAccounts = await prisma.instagramAccount.findMany({
            where: { organizationId },
            select: { followersCount: true }
        });
        const igFollowers = igAccounts.reduce((sum, acc) => sum + acc.followersCount, 0);

        return {
            overview: {
                totalEngagement: waStats + (igStats._sum.dmsSent || 0) + (igStats._sum.commentsReplied || 0),
                waVolume: waStats,
                igVolume: (igStats._sum.dmsSent || 0) + (igStats._sum.commentsReplied || 0),
            },
            audience: {
                whatsappContacts: waContacts,
                instagramFollowers: igFollowers
            },
            performance: {
                waDeliveryRate: 98, // Example: logic exists in wa stats
                igAutomationRate: igStats._sum.automationReplies || 0
            }
        };
    }

    // ============================================
    // MESSAGE ANALYTICS
    // ============================================

    async getMessageAnalytics(organizationId: string, days: number = 30) {
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);

        // Get messages grouped by date
        const messages = await prisma.message.findMany({
            where: {
                conversation: { organizationId },
                createdAt: { gte: startDate },
            },
            select: {
                direction: true,
                status: true,
                type: true,
                createdAt: true,
            },
        });

        // Process daily stats - Fill in zeros for a continuous timeline
        const dailyStats: Record<string, {
            date: string;
            sent: number;
            delivered: number;
            read: number;
            failed: number;
            received: number;
        }> = {};

        // Initialize all dates in the range
        for (let i = 0; i <= days; i++) {
            const date = new Date();
            date.setDate(date.getDate() - (days - i));
            const dateKey = date.toISOString().split('T')[0];
            dailyStats[dateKey] = {
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
            if (dailyStats[dateKey]) {
                if (msg.direction === 'OUTBOUND') {
                    dailyStats[dateKey].sent++;
                    if (msg.status === 'DELIVERED') dailyStats[dateKey].delivered++;
                    if (msg.status === 'READ') {
                        dailyStats[dateKey].delivered++;
                        dailyStats[dateKey].read++;
                    }
                    if (msg.status === 'FAILED') dailyStats[dateKey].failed++;
                } else {
                    dailyStats[dateKey].received++;
                }
            }
        });

        // Convert to array and sort
        const chartData = Object.values(dailyStats).sort((a, b) =>
            new Date(a.date).getTime() - new Date(b.date).getTime()
        );

        // Calculate totals
        const totals = {
            sent: messages.filter(m => m.direction === 'OUTBOUND').length,
            delivered: messages.filter(m => m.direction === 'OUTBOUND' && ['DELIVERED', 'READ'].includes(m.status)).length,
            read: messages.filter(m => m.direction === 'OUTBOUND' && m.status === 'READ').length,
            failed: messages.filter(m => m.direction === 'OUTBOUND' && m.status === 'FAILED').length,
            received: messages.filter(m => m.direction === 'INBOUND').length,
        };

        // Calculate rates
        const deliveryRate = totals.sent > 0 ? Math.round((totals.delivered / totals.sent) * 100) : 0;
        const readRate = totals.delivered > 0 ? Math.round((totals.read / totals.delivered) * 100) : 0;
        const failureRate = totals.sent > 0 ? Math.round((totals.failed / totals.sent) * 100) : 0;

        // Message type breakdown
        const typeBreakdown = messages.reduce((acc, msg) => {
            acc[msg.type] = (acc[msg.type] || 0) + 1;
            return acc;
        }, {} as Record<string, number>);

        return {
            chartData,
            totals,
            rates: {
                delivery: deliveryRate,
                read: readRate,
                failure: failureRate,
            },
            typeBreakdown: Object.entries(typeBreakdown).map(([type, count]) => ({
                type,
                count,
                percentage: Math.round((count / messages.length) * 100),
            })),
        };
    }

    // ============================================
    // CAMPAIGN ANALYTICS
    // ============================================

    async getCampaignAnalytics(organizationId: string, limit: number = 10) {
        // Get recent campaigns with stats
        const campaigns = await prisma.campaign.findMany({
            where: { organizationId },
            orderBy: { createdAt: 'desc' },
            take: limit,
            include: {
                template: { select: { name: true } },
                _count: {
                    select: { campaignContacts: true },
                },
            },
        });

        // Calculate performance for each campaign
        const campaignStats = campaigns.map((campaign) => {
            const deliveryRate = campaign.sentCount > 0
                ? Math.round((campaign.deliveredCount / campaign.sentCount) * 100)
                : 0;
            const readRate = campaign.deliveredCount > 0
                ? Math.round((campaign.readCount / campaign.deliveredCount) * 100)
                : 0;
            const failureRate = campaign.totalContacts > 0
                ? Math.round((campaign.failedCount / campaign.totalContacts) * 100)
                : 0;

            return {
                id: campaign.id,
                name: campaign.name,
                templateName: campaign.template.name,
                status: campaign.status,
                totalContacts: campaign.totalContacts,
                sentCount: campaign.sentCount,
                deliveredCount: campaign.deliveredCount,
                readCount: campaign.readCount,
                failedCount: campaign.failedCount,
                deliveryRate,
                readRate,
                failureRate,
                createdAt: campaign.createdAt,
                completedAt: campaign.completedAt,
            };
        });

        // Status breakdown
        const statusBreakdown = await prisma.campaign.groupBy({
            by: ['status'],
            where: { organizationId },
            _count: true,
        });

        // Overall campaign stats
        const overallStats = await prisma.campaign.aggregate({
            where: { organizationId },
            _sum: {
                totalContacts: true,
                sentCount: true,
                deliveredCount: true,
                readCount: true,
                failedCount: true,
            },
        });

        const overall = overallStats._sum;
        const avgDeliveryRate = (overall.sentCount || 0) > 0
            ? Math.round(((overall.deliveredCount || 0) / (overall.sentCount || 1)) * 100)
            : 0;
        const avgReadRate = (overall.deliveredCount || 0) > 0
            ? Math.round(((overall.readCount || 0) / (overall.deliveredCount || 1)) * 100)
            : 0;

        return {
            campaigns: campaignStats,
            statusBreakdown: statusBreakdown.map((s) => ({
                status: s.status,
                count: s._count,
            })),
            overall: {
                totalCampaigns: campaigns.length,
                totalContacts: overall.totalContacts || 0,
                totalSent: overall.sentCount || 0,
                totalDelivered: overall.deliveredCount || 0,
                totalRead: overall.readCount || 0,
                totalFailed: overall.failedCount || 0,
                avgDeliveryRate,
                avgReadRate,
            },
        };
    }

    // ============================================
    // CONTACT ANALYTICS
    // ============================================

    async getContactAnalytics(organizationId: string, days: number = 30) {
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);

        // Get contacts grouped by date
        const contacts = await prisma.contact.findMany({
            where: {
                organizationId,
                createdAt: { gte: startDate },
            },
            select: {
                id: true,
                status: true,
                source: true,
                tags: true,
                createdAt: true,
            },
        });

        // Process daily stats - Fill in zeros for a continuous timeline
        const dailyStats: Record<string, { date: string; count: number }> = {};
        for (let i = 0; i <= days; i++) {
            const date = new Date();
            date.setDate(date.getDate() - (days - i));
            const dateKey = date.toISOString().split('T')[0];
            dailyStats[dateKey] = { date: dateKey, count: 0 };
        }

        contacts.forEach((contact) => {
            const dateKey = contact.createdAt.toISOString().split('T')[0];
            if (dailyStats[dateKey]) {
                dailyStats[dateKey].count++;
            }
        });

        const chartData = Object.values(dailyStats).sort((a, b) =>
            new Date(a.date).getTime() - new Date(b.date).getTime()
        );

        // Source breakdown
        const sourceBreakdown = contacts.reduce((acc, contact) => {
            const source = contact.source || 'Unknown';
            acc[source] = (acc[source] || 0) + 1;
            return acc;
        }, {} as Record<string, number>);

        // Status breakdown
        const statusBreakdown = await prisma.contact.groupBy({
            by: ['status'],
            where: { organizationId },
            _count: true,
        });

        // Tag breakdown
        const allTags: Record<string, number> = {};
        contacts.forEach((contact) => {
            (contact.tags || []).forEach((tag) => {
                allTags[tag] = (allTags[tag] || 0) + 1;
            });
        });

        const topTags = Object.entries(allTags)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10)
            .map(([tag, count]) => ({ tag, count }));

        // Total counts
        const totalContacts = await prisma.contact.count({ where: { organizationId } });
        const activeContacts = await prisma.contact.count({
            where: { organizationId, status: 'ACTIVE' },
        });

        return {
            chartData,
            totals: {
                total: totalContacts,
                active: activeContacts,
                newThisPeriod: contacts.length,
            },
            sourceBreakdown: Object.entries(sourceBreakdown).map(([source, count]) => ({
                source,
                count,
                percentage: Math.round((count / contacts.length) * 100),
            })),
            statusBreakdown: statusBreakdown.map((s) => ({
                status: s.status,
                count: s._count,
            })),
            topTags,
        };
    }

    // ============================================
    // CONVERSATION ANALYTICS
    // ============================================

    async getConversationAnalytics(organizationId: string, days: number = 30) {
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);

        // Get conversations
        const conversations = await prisma.conversation.findMany({
            where: {
                organizationId,
                updatedAt: { gte: startDate },
            },
            select: {
                id: true,
                isWindowOpen: true,
                unreadCount: true,
                lastMessageAt: true,
                createdAt: true,
                _count: {
                    select: { messages: true },
                },
            },
        });

        // Daily active conversations
        const dailyStats: Record<string, { date: string; active: number; new: number }> = {};

        conversations.forEach((conv) => {
            const createdDateKey = conv.createdAt.toISOString().split('T')[0];
            const lastActiveDateKey = conv.lastMessageAt?.toISOString().split('T')[0];

            // New conversations
            if (!dailyStats[createdDateKey]) {
                dailyStats[createdDateKey] = { date: createdDateKey, active: 0, new: 0 };
            }
            dailyStats[createdDateKey].new++;

            // Active conversations
            if (lastActiveDateKey && lastActiveDateKey !== createdDateKey) {
                if (!dailyStats[lastActiveDateKey]) {
                    dailyStats[lastActiveDateKey] = { date: lastActiveDateKey, active: 0, new: 0 };
                }
                dailyStats[lastActiveDateKey].active++;
            }
        });

        const chartData = Object.values(dailyStats).sort((a, b) =>
            new Date(a.date).getTime() - new Date(b.date).getTime()
        );

        // Stats
        const totalConversations = await prisma.conversation.count({ where: { organizationId } });
        const openWindows = await prisma.conversation.count({
            where: { organizationId, isWindowOpen: true },
        });
        const unreadConversations = await prisma.conversation.count({
            where: { organizationId, unreadCount: { gt: 0 } },
        });

        // Average messages per conversation
        const totalMessages = conversations.reduce((sum, conv) => sum + conv._count.messages, 0);
        const avgMessagesPerConversation = conversations.length > 0
            ? Math.round(totalMessages / conversations.length)
            : 0;

        return {
            chartData,
            totals: {
                total: totalConversations,
                openWindows,
                unread: unreadConversations,
                avgMessagesPerConversation,
            },
        };
    }

    // ============================================
    // TEMPLATE ANALYTICS
    // ============================================

    async getTemplateAnalytics(organizationId: string) {
        // Get templates with usage stats
        const templates = await prisma.template.findMany({
            where: { organizationId },
            include: {
                _count: {
                    select: { campaigns: true },
                },
            },
        });

        // Get message counts per template
        const templateUsage = await prisma.message.groupBy({
            by: ['templateName'],
            where: {
                conversation: { organizationId },
                templateName: { not: null },
            },
            _count: true,
        });

        const usageMap = new Map(
            templateUsage.map((t) => [t.templateName, t._count])
        );

        const templateStats = templates.map((template) => ({
            id: template.id,
            name: template.name,
            category: template.category,
            status: template.status,
            campaignsUsed: template._count.campaigns,
            messagesSent: usageMap.get(template.name) || 0,
            language: template.language,
            createdAt: template.createdAt,
        }));

        // Sort by usage
        templateStats.sort((a, b) => b.messagesSent - a.messagesSent);

        // Status breakdown
        const statusBreakdown = await prisma.template.groupBy({
            by: ['status'],
            where: { organizationId },
            _count: true,
        });

        // Category breakdown
        const categoryBreakdown = await prisma.template.groupBy({
            by: ['category'],
            where: { organizationId },
            _count: true,
        });

        return {
            templates: templateStats,
            totals: {
                total: templates.length,
                approved: templates.filter((t) => t.status === 'APPROVED').length,
                pending: templates.filter((t) => t.status === 'PENDING').length,
                rejected: templates.filter((t) => t.status === 'REJECTED').length,
            },
            statusBreakdown: statusBreakdown.map((s) => ({
                status: s.status,
                count: s._count,
            })),
            categoryBreakdown: categoryBreakdown.map((c) => ({
                category: c.category,
                count: c._count,
            })),
            topTemplates: templateStats.slice(0, 5),
        };
    }

    // ============================================
    // EXPORT DATA
    // ============================================

    async exportAnalytics(organizationId: string, type: string, format: string = 'json') {
        let data: any;

        switch (type) {
            case 'messages':
                data = await this.getMessageAnalytics(organizationId, 90);
                break;
            case 'campaigns':
                data = await this.getCampaignAnalytics(organizationId, 50);
                break;
            case 'contacts':
                data = await this.getContactAnalytics(organizationId, 90);
                break;
            case 'conversations':
                data = await this.getConversationAnalytics(organizationId, 90);
                break;
            case 'templates':
                data = await this.getTemplateAnalytics(organizationId);
                break;
            case 'overview':
            default:
                data = await this.getOverviewStats(organizationId);
        }

        if (format === 'csv') {
            return this.convertToCSV(data, type);
        }

        return data;
    }

    private convertToCSV(data: any, type: string): string {
        // Simple CSV conversion
        if (type === 'messages' && data.chartData) {
            const headers = ['Date', 'Sent', 'Delivered', 'Read', 'Failed', 'Received'];
            const rows = data.chartData.map((row: any) =>
                [row.date, row.sent, row.delivered, row.read, row.failed, row.received].join(',')
            );
            return [headers.join(','), ...rows].join('\n');
        }

        if (type === 'contacts' && data.chartData) {
            const headers = ['Date', 'New Contacts'];
            const rows = data.chartData.map((row: any) => [row.date, row.count].join(','));
            return [headers.join(','), ...rows].join('\n');
        }

        // Default JSON string for complex data
        return JSON.stringify(data, null, 2);
    }
}

export const analyticsService = new AnalyticsService();
export default analyticsService;
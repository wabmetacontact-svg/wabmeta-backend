"use strict";
// src/modules/analytics/analytics.service.ts
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.analyticsService = exports.AnalyticsService = void 0;
const client_1 = require("@prisma/client");
const database_1 = __importDefault(require("../../config/database"));
class AnalyticsService {
    // ============================================
    // OVERVIEW STATS
    // ============================================
    async getOverviewStats(organizationId, dateRange) {
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);
        const start = dateRange?.start || startOfMonth;
        const end = dateRange?.end || now;
        // Current period stats
        const [totalContacts, newContactsThisPeriod, newContactsLastPeriod, totalConversations, unreadConversations, totalMessagesSent, totalMessagesReceived, messagesThisPeriod, messagesLastPeriod, totalCampaigns, activeCampaigns, completedCampaigns, totalTemplates, approvedTemplates,] = await Promise.all([
            // Contacts
            database_1.default.contact.count({ where: { organizationId } }),
            database_1.default.contact.count({
                where: { organizationId, createdAt: { gte: start, lte: end } },
            }),
            database_1.default.contact.count({
                where: { organizationId, createdAt: { gte: startOfLastMonth, lte: endOfLastMonth } },
            }),
            // Conversations
            database_1.default.conversation.count({ where: { organizationId } }),
            database_1.default.conversation.count({ where: { organizationId, isRead: false } }),
            // Messages
            database_1.default.message.count({
                where: { conversation: { organizationId }, direction: 'OUTBOUND' },
            }),
            database_1.default.message.count({
                where: { conversation: { organizationId }, direction: 'INBOUND' },
            }),
            database_1.default.message.count({
                where: {
                    conversation: { organizationId },
                    direction: 'OUTBOUND',
                    createdAt: { gte: start, lte: end },
                },
            }),
            database_1.default.message.count({
                where: {
                    conversation: { organizationId },
                    direction: 'OUTBOUND',
                    createdAt: { gte: startOfLastMonth, lte: endOfLastMonth },
                },
            }),
            // Campaigns
            database_1.default.campaign.count({ where: { organizationId } }),
            database_1.default.campaign.count({ where: { organizationId, status: client_1.CampaignStatus.RUNNING } }),
            database_1.default.campaign.count({ where: { organizationId, status: client_1.CampaignStatus.COMPLETED } }),
            // Templates
            database_1.default.template.count({ where: { organizationId } }),
            database_1.default.template.count({ where: { organizationId, status: 'APPROVED' } }),
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
    // ============================================
    // MESSAGE ANALYTICS
    // ============================================
    async getMessageAnalytics(organizationId, days = 30) {
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);
        // Get messages grouped by date
        const messages = await database_1.default.message.findMany({
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
        const dailyStats = {};
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
                    if (msg.status === 'DELIVERED')
                        dailyStats[dateKey].delivered++;
                    if (msg.status === 'READ') {
                        dailyStats[dateKey].delivered++;
                        dailyStats[dateKey].read++;
                    }
                    if (msg.status === 'FAILED')
                        dailyStats[dateKey].failed++;
                }
                else {
                    dailyStats[dateKey].received++;
                }
            }
        });
        // Convert to array and sort
        const chartData = Object.values(dailyStats).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
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
        }, {});
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
    async getCampaignAnalytics(organizationId, limit = 10) {
        // Get recent campaigns with stats
        const campaigns = await database_1.default.campaign.findMany({
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
        const statusBreakdown = await database_1.default.campaign.groupBy({
            by: ['status'],
            where: { organizationId },
            _count: true,
        });
        // Overall campaign stats
        const overallStats = await database_1.default.campaign.aggregate({
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
    async getContactAnalytics(organizationId, days = 30) {
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);
        // Get contacts grouped by date
        const contacts = await database_1.default.contact.findMany({
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
        const dailyStats = {};
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
        const chartData = Object.values(dailyStats).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
        // Source breakdown
        const sourceBreakdown = contacts.reduce((acc, contact) => {
            const source = contact.source || 'Unknown';
            acc[source] = (acc[source] || 0) + 1;
            return acc;
        }, {});
        // Status breakdown
        const statusBreakdown = await database_1.default.contact.groupBy({
            by: ['status'],
            where: { organizationId },
            _count: true,
        });
        // Tag breakdown
        const allTags = {};
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
        const totalContacts = await database_1.default.contact.count({ where: { organizationId } });
        const activeContacts = await database_1.default.contact.count({
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
    async getConversationAnalytics(organizationId, days = 30) {
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);
        // Get conversations
        const conversations = await database_1.default.conversation.findMany({
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
        const dailyStats = {};
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
        const chartData = Object.values(dailyStats).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
        // Stats
        const totalConversations = await database_1.default.conversation.count({ where: { organizationId } });
        const openWindows = await database_1.default.conversation.count({
            where: { organizationId, isWindowOpen: true },
        });
        const unreadConversations = await database_1.default.conversation.count({
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
    async getTemplateAnalytics(organizationId) {
        // Get templates with usage stats
        const templates = await database_1.default.template.findMany({
            where: { organizationId },
            include: {
                _count: {
                    select: { campaigns: true },
                },
            },
        });
        // Get message counts per template
        const templateUsage = await database_1.default.message.groupBy({
            by: ['templateName'],
            where: {
                conversation: { organizationId },
                templateName: { not: null },
            },
            _count: true,
        });
        const usageMap = new Map(templateUsage.map((t) => [t.templateName, t._count]));
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
        const statusBreakdown = await database_1.default.template.groupBy({
            by: ['status'],
            where: { organizationId },
            _count: true,
        });
        // Category breakdown
        const categoryBreakdown = await database_1.default.template.groupBy({
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
    async exportAnalytics(organizationId, type, format = 'json') {
        let data;
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
    convertToCSV(data, type) {
        // Simple CSV conversion
        if (type === 'messages' && data.chartData) {
            const headers = ['Date', 'Sent', 'Delivered', 'Read', 'Failed', 'Received'];
            const rows = data.chartData.map((row) => [row.date, row.sent, row.delivered, row.read, row.failed, row.received].join(','));
            return [headers.join(','), ...rows].join('\n');
        }
        if (type === 'contacts' && data.chartData) {
            const headers = ['Date', 'New Contacts'];
            const rows = data.chartData.map((row) => [row.date, row.count].join(','));
            return [headers.join(','), ...rows].join('\n');
        }
        // Default JSON string for complex data
        return JSON.stringify(data, null, 2);
    }
}
exports.AnalyticsService = AnalyticsService;
exports.analyticsService = new AnalyticsService();
exports.default = exports.analyticsService;
//# sourceMappingURL=analytics.service.js.map
"use strict";
// src/services/templateMediaPreWarm.service.ts - PRODUCTION FIX
// ✅ Uses shared getFreshMediaIdForSending
// ✅ No duplicate upload logic
// ✅ Better error handling
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.templateMediaPreWarmService = exports.TemplateMediaPreWarmService = void 0;
const database_1 = __importDefault(require("../config/database"));
const client_1 = require("@prisma/client");
const templateMediaResolver_1 = require("../utils/templateMediaResolver");
class TemplateMediaPreWarmService {
    isRunning = false;
    async preWarmExpiringMedia() {
        if (this.isRunning) {
            console.log('⏳ Pre-warm already running, skipping...');
            return { checked: 0, refreshed: 0, failed: 0 };
        }
        this.isRunning = true;
        console.log('🔥 Starting template media pre-warm...');
        let checked = 0;
        let refreshed = 0;
        let failed = 0;
        try {
            const REFRESH_THRESHOLD_DAYS = 20; // Refresh media > 20 days old
            const thresholdDate = new Date(Date.now() - REFRESH_THRESHOLD_DAYS * 24 * 60 * 60 * 1000);
            const templates = await database_1.default.template.findMany({
                where: {
                    status: 'APPROVED',
                    headerType: { in: ['IMAGE', 'VIDEO', 'DOCUMENT'] },
                    headerContent: { not: null },
                    whatsappAccount: {
                        status: client_1.WhatsAppAccountStatus.CONNECTED,
                    },
                    OR: [
                        { headerMediaUploadedAt: null },
                        { headerMediaUploadedAt: { lt: thresholdDate } },
                        { headerMediaId: null },
                    ],
                },
                include: { whatsappAccount: true },
                take: 50,
                orderBy: { headerMediaUploadedAt: 'asc' },
            });
            console.log(`📋 Found ${templates.length} templates needing refresh`);
            checked = templates.length;
            for (const template of templates) {
                try {
                    console.log(`🔄 Pre-warming: ${template.name}`);
                    // ✅ Use shared function - no code duplication
                    const freshId = await (0, templateMediaResolver_1.getFreshMediaIdForSending)(template.id);
                    if (freshId) {
                        console.log(`✅ Pre-warmed: ${template.name} → ${freshId}`);
                        refreshed++;
                    }
                    else {
                        console.warn(`⚠️ Failed to pre-warm: ${template.name}`);
                        failed++;
                    }
                    // Throttle: 2 seconds between uploads
                    await new Promise(r => setTimeout(r, 2000));
                }
                catch (err) {
                    console.error(`❌ Pre-warm error for ${template.name}:`, err.message);
                    failed++;
                    // Auto-disconnect broken accounts
                    const isTokenError = err.message?.includes('token') ||
                        err.message?.includes('OAuth') ||
                        err.message?.includes('190') ||
                        err.message?.includes('not registered');
                    if (isTokenError && template.whatsappAccount?.id) {
                        console.warn(`⚠️ Disconnecting broken account: ${template.whatsappAccount.id}`);
                        await database_1.default.whatsAppAccount.update({
                            where: { id: template.whatsappAccount.id },
                            data: {
                                status: client_1.WhatsAppAccountStatus.DISCONNECTED,
                                accessToken: null,
                            },
                        }).catch(() => { });
                    }
                }
            }
            console.log(`🏁 Pre-warm complete: ${refreshed}/${checked} refreshed, ${failed} failed`);
            return { checked, refreshed, failed };
        }
        finally {
            this.isRunning = false;
        }
    }
}
exports.TemplateMediaPreWarmService = TemplateMediaPreWarmService;
exports.templateMediaPreWarmService = new TemplateMediaPreWarmService();
//# sourceMappingURL=templateMediaPreWarm.service.js.map
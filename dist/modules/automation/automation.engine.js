"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.automationEngine = void 0;
const database_1 = __importDefault(require("../../config/database"));
const whatsapp_service_1 = require("../whatsapp/whatsapp.service");
const automation_service_1 = require("./automation.service");
const wallet_deduction_service_1 = require("../wallet/wallet.deduction.service");
class AutomationEngine {
    // ==========================================
    // ✅ GROUP CHECK HELPER
    // ==========================================
    async isContactInTargetGroups(contactId, targetGroupIds) {
        // If no groups specified, allow all
        if (!targetGroupIds || targetGroupIds.length === 0) {
            return true;
        }
        const membership = await database_1.default.contactGroupMember.findFirst({
            where: {
                contactId,
                groupId: { in: targetGroupIds },
            },
        });
        return !!membership;
    }
    // ==========================================
    // ✅ TRIGGER: UNKNOWN MESSAGE
    // ==========================================
    async triggerUnknownMessage(context) {
        console.log(`🤖 [UNKNOWN_MESSAGE] Triggered for org: ${context.organizationId}, phone: ${context.phone}`);
        if (!context.phone) {
            console.warn(`⚠️ [UNKNOWN_MESSAGE] No phone in context`);
            return;
        }
        try {
            const automations = await automation_service_1.automationService.getActiveByTrigger(context.organizationId, 'UNKNOWN_MESSAGE');
            if (automations.length === 0) {
                console.log(`ℹ️ [UNKNOWN_MESSAGE] No active automations for this org`);
                return;
            }
            console.log(`🤖 [UNKNOWN_MESSAGE] Found ${automations.length} automation(s)`);
            // ✅ Check if contact ALREADY existed BEFORE this message
            // (Different from just "exists" - we check if they existed before now)
            const contactExistedBefore = await this.contactExistedBefore(context.organizationId, context.phone);
            console.log(`🔍 [UNKNOWN_MESSAGE] Contact existed before: ${contactExistedBefore}`);
            for (const automation of automations) {
                try {
                    // ✅ Skip if contact existed BEFORE and excludeExisting is ON
                    if (automation.excludeExisting && contactExistedBefore) {
                        console.log(`⏭️ [UNKNOWN_MESSAGE] Skipping ${automation.name}: contact exists`);
                        continue;
                    }
                    // ✅ Cooldown check - prevent spam if same unknown number messages multiple times
                    // Only trigger once per contact per automation per 24 hours
                    if (context.contactId) {
                        const recentRun = await database_1.default.automationSequence.findFirst({
                            where: {
                                automationId: automation.id,
                                contactId: context.contactId,
                                createdAt: { gt: new Date(Date.now() - 24 * 60 * 60 * 1000) },
                            },
                        });
                        if (recentRun) {
                            console.log(`⏭️ [UNKNOWN_MESSAGE] Skipping ${automation.name}: already ran in last 24h`);
                            continue;
                        }
                    }
                    // Group check (if applicable)
                    if (context.contactId && automation.targetGroupIds?.length > 0) {
                        const inGroup = await this.isContactInTargetGroups(context.contactId, automation.targetGroupIds);
                        if (!inGroup) {
                            console.log(`⏭️ [UNKNOWN_MESSAGE] Not in target groups: ${automation.name}`);
                            continue;
                        }
                    }
                    console.log(`🚀 [UNKNOWN_MESSAGE] Executing: ${automation.name}`);
                    await this.executeSequence(automation.id, automation.actions, context);
                }
                catch (err) {
                    console.error(`❌ [UNKNOWN_MESSAGE] Failed ${automation.id}:`, err.message);
                }
            }
        }
        catch (error) {
            if (error?.code !== 'P2024') {
                console.error('🤖 [UNKNOWN_MESSAGE] Error:', error);
            }
        }
    }
    // ==========================================
    // ✅ NEW HELPER: Check if contact existed BEFORE now
    // ==========================================
    async contactExistedBefore(organizationId, phone, toleranceMs = 10000 // 10 seconds tolerance
    ) {
        try {
            const cutoffTime = new Date(Date.now() - toleranceMs);
            const contact = await database_1.default.contact.findFirst({
                where: {
                    organizationId,
                    phone,
                    createdAt: { lt: cutoffTime },
                },
                select: { id: true },
            });
            return !!contact;
        }
        catch (error) {
            if (error?.code === 'P2024')
                return false;
            throw error;
        }
    }
    // ==========================================
    // ✅ TRIGGER: KEYWORD (Enhanced with Groups)
    // ==========================================
    async triggerKeyword(context) {
        if (!context.message)
            return false;
        console.log(`🤖 [AUTOMATION] Checking KEYWORD triggers for: "${context.message}"`);
        try {
            const automations = await automation_service_1.automationService.getActiveByTrigger(context.organizationId, 'KEYWORD');
            let triggered = false;
            for (const automation of automations) {
                // ✅ Check target groups first
                if (context.contactId && automation.targetGroupIds?.length > 0) {
                    const inTargetGroup = await this.isContactInTargetGroups(context.contactId, automation.targetGroupIds);
                    if (!inTargetGroup) {
                        console.log(`⏭️ Contact not in target groups. Skipping: ${automation.name}`);
                        continue;
                    }
                }
                const keywords = automation.triggerConfig?.keywords || [];
                const exactMatch = automation.triggerConfig?.exactMatch || false;
                const messageL = context.message.toLowerCase().trim();
                const matched = keywords.some((keyword) => {
                    const keywordL = keyword.toLowerCase().trim();
                    if (exactMatch) {
                        return messageL === keywordL;
                    }
                    return messageL.includes(keywordL);
                });
                if (matched) {
                    console.log(`🤖 Keyword matched! Executing automation: ${automation.name}`);
                    await this.executeSequence(automation.id, automation.actions, context);
                    triggered = true;
                }
            }
            return triggered;
        }
        catch (error) {
            console.error('🤖 KEYWORD automation error:', error);
            return false;
        }
    }
    // ==========================================
    // ✅ TRIGGER: NEW CONTACT (Enhanced with Groups)
    // ==========================================
    async triggerNewContact(context) {
        console.log(`🤖 [AUTOMATION] Triggering NEW_CONTACT for org: ${context.organizationId}`);
        try {
            const automations = await automation_service_1.automationService.getActiveByTrigger(context.organizationId, 'NEW_CONTACT');
            for (const automation of automations) {
                // ✅ Check target groups
                if (context.contactId && automation.targetGroupIds?.length > 0) {
                    const inTargetGroup = await this.isContactInTargetGroups(context.contactId, automation.targetGroupIds);
                    if (!inTargetGroup) {
                        console.log(`⏭️ Contact not in target groups. Skipping: ${automation.name}`);
                        continue;
                    }
                }
                console.log(`🤖 Executing automation: ${automation.name}`);
                await this.executeSequence(automation.id, automation.actions, context);
            }
        }
        catch (error) {
            console.error('🤖 NEW_CONTACT automation error:', error);
        }
    }
    // ==========================================
    // ✅ TRIGGER: Webhook
    // ==========================================
    async triggerWebhook(organizationId, automationId, context) {
        console.log(`🤖 Triggering webhook automation: ${automationId}`);
        try {
            const automation = await automation_service_1.automationService.getById(organizationId, automationId);
            if (!automation.isActive || automation.trigger !== 'WEBHOOK') {
                console.log('🤖 Automation not active or not webhook type');
                return;
            }
            await this.executeSequence(automation.id, automation.actions, context);
        }
        catch (error) {
            console.error('🤖 Webhook automation error:', error);
        }
    }
    // ==========================================
    // ✅ FIXED: TRIGGER: Scheduled (Time-based)
    // ==========================================
    async triggerScheduled() {
        try {
            const now = new Date();
            const currentHHMM = now.toTimeString().substring(0, 5); // "09:30"
            const currentDay = now.getDay(); // 0=Sun, 1=Mon, ..., 6=Sat
            const isWeekday = currentDay >= 1 && currentDay <= 5;
            const isWeekend = currentDay === 0 || currentDay === 6;
            let triggeredCount = 0;
            if (process.env.LOG_SCHEDULER === 'verbose') {
                console.log(`⏰ [SCHEDULE] Checking triggers at ${currentHHMM} (day ${currentDay})`);
            }
            // ✅ FIX: undefined orgId = get all orgs
            const automations = await automation_service_1.automationService.getActiveByTrigger(undefined, 'SCHEDULE');
            if (automations.length === 0) {
                return; // No scheduled automations
            }
            console.log(`⏰ [SCHEDULE] Found ${automations.length} scheduled automation(s)`);
            for (const automation of automations) {
                try {
                    const config = automation.triggerConfig;
                    const scheduledTime = config?.time || '09:00'; // Default 9 AM
                    const days = config?.days || 'daily'; // daily | weekdays | weekends
                    // ✅ Check if today matches recursion
                    let shouldRunToday = false;
                    if (days === 'daily')
                        shouldRunToday = true;
                    else if (days === 'weekdays' && isWeekday)
                        shouldRunToday = true;
                    else if (days === 'weekends' && isWeekend)
                        shouldRunToday = true;
                    if (!shouldRunToday) {
                        console.log(`⏭️ [SCHEDULE] ${automation.name}: Not scheduled for today (${days})`);
                        continue;
                    }
                    // ✅ Check if current time matches (with 1-minute tolerance)
                    const [schedHour, schedMin] = scheduledTime.split(':').map(Number);
                    const [currHour, currMin] = currentHHMM.split(':').map(Number);
                    const schedMinutes = schedHour * 60 + schedMin;
                    const currMinutes = currHour * 60 + currMin;
                    const diffMinutes = Math.abs(schedMinutes - currMinutes);
                    if (diffMinutes > 1) {
                        // Not the scheduled time yet
                        continue;
                    }
                    // ✅ CRITICAL: Prevent duplicate runs on same day
                    if (automation.lastExecutedAt) {
                        const lastRun = new Date(automation.lastExecutedAt);
                        const lastRunDate = lastRun.toDateString();
                        const todayDate = now.toDateString();
                        if (lastRunDate === todayDate) {
                            console.log(`⏭️ [SCHEDULE] ${automation.name}: Already ran today`);
                            continue;
                        }
                    }
                    triggeredCount++;
                    console.log(`🚀 [SCHEDULE] Executing: ${automation.name} for org: ${automation.organizationId}`);
                    // ✅ Get target contacts
                    const targetGroupIds = automation.targetGroupIds || [];
                    let contacts = [];
                    try {
                        if (targetGroupIds.length > 0) {
                            contacts = await database_1.default.contact.findMany({
                                where: {
                                    organizationId: automation.organizationId,
                                    status: 'ACTIVE',
                                    groupMemberships: {
                                        some: { groupId: { in: targetGroupIds } },
                                    },
                                },
                                select: { id: true, phone: true, firstName: true },
                                take: 500, // Safety limit
                            });
                        }
                        else {
                            // No groups = ALL active contacts
                            contacts = await database_1.default.contact.findMany({
                                where: {
                                    organizationId: automation.organizationId,
                                    status: 'ACTIVE',
                                },
                                select: { id: true, phone: true, firstName: true },
                                take: 500,
                            });
                        }
                    }
                    catch (dbErr) {
                        if (dbErr?.code === 'P2024') {
                            console.warn(`⚠️ [SCHEDULE] DB busy, skipping ${automation.name}`);
                            continue;
                        }
                        throw dbErr;
                    }
                    console.log(`📇 [SCHEDULE] ${automation.name}: ${contacts.length} contacts targeted`);
                    if (contacts.length === 0) {
                        console.log(`⏭️ [SCHEDULE] No contacts found for ${automation.name}`);
                        // Still mark as executed for the day
                        await automation_service_1.automationService.incrementExecutionCount(automation.id);
                        continue;
                    }
                    // ✅ Mark as executed BEFORE processing (prevents duplicates)
                    await automation_service_1.automationService.incrementExecutionCount(automation.id);
                    // ✅ Execute sequentially with small delay (avoid rate limits)
                    for (const contact of contacts) {
                        try {
                            await this.executeSequence(automation.id, automation.actions, {
                                organizationId: automation.organizationId,
                                contactId: contact.id,
                                phone: contact.phone,
                            });
                            // Small delay between contacts (200ms)
                            await new Promise((r) => setTimeout(r, 200));
                        }
                        catch (err) {
                            console.error(`❌ [SCHEDULE] Failed for contact ${contact.id}:`, err.message);
                        }
                    }
                    console.log(`✅ [SCHEDULE] Completed: ${automation.name}`);
                }
                catch (err) {
                    if (err?.code !== 'P2024') {
                        console.error(`❌ [SCHEDULE] Automation ${automation.id} failed:`, err.message);
                    }
                }
            }
            if (triggeredCount > 0) {
                console.log(`✅ [SCHEDULE] Fired ${triggeredCount} triggers at ${currentHHMM}`);
            }
        }
        catch (error) {
            if (error?.code !== 'P2024') {
                console.error('🤖 Scheduled automation trigger error:', error);
            }
        }
    }
    // ==========================================
    // ✅ FIXED: TRIGGER: Contact Inactivity
    // ==========================================
    async triggerInactivity() {
        try {
            console.log(`💤 [INACTIVITY] Starting inactivity check...`);
            // ✅ FIX: undefined orgId = get all orgs
            const automations = await automation_service_1.automationService.getActiveByTrigger(undefined, 'INACTIVITY');
            if (automations.length === 0) {
                return;
            }
            console.log(`💤 [INACTIVITY] Found ${automations.length} automation(s)`);
            for (const automation of automations) {
                try {
                    const config = automation.triggerConfig;
                    const hours = Number(config?.hours) || 24;
                    const inactiveSince = new Date(Date.now() - hours * 60 * 60 * 1000);
                    console.log(`💤 [INACTIVITY] ${automation.name}: checking ${hours}h inactive`);
                    // ✅ Target contacts (with group filtering)
                    const targetGroupIds = automation.targetGroupIds || [];
                    const whereClause = {
                        organizationId: automation.organizationId,
                        status: 'ACTIVE',
                        lastMessageAt: { lt: inactiveSince, not: null },
                    };
                    if (targetGroupIds.length > 0) {
                        whereClause.groupMemberships = {
                            some: { groupId: { in: targetGroupIds } },
                        };
                    }
                    let contacts = [];
                    try {
                        contacts = await database_1.default.contact.findMany({
                            where: whereClause,
                            select: {
                                id: true,
                                phone: true,
                                firstName: true,
                                lastMessageAt: true,
                            },
                            take: 100, // Safety limit
                            orderBy: { lastMessageAt: 'asc' }, // Oldest first
                        });
                    }
                    catch (dbErr) {
                        if (dbErr?.code === 'P2024') {
                            console.warn(`⚠️ [INACTIVITY] DB busy, skipping ${automation.name}`);
                            continue;
                        }
                        throw dbErr;
                    }
                    if (contacts.length === 0) {
                        continue;
                    }
                    // ✅ Filter out contacts who already got this inactivity message recently
                    const contactIds = contacts.map((c) => c.id);
                    const recentSequences = await database_1.default.automationSequence.findMany({
                        where: {
                            automationId: automation.id,
                            contactId: { in: contactIds },
                            // Already ran within cooldown period (e.g. within last inactivity window)
                            lastStepAt: { gt: inactiveSince },
                        },
                        select: { contactId: true },
                    });
                    const alreadyRunSet = new Set(recentSequences.map((s) => s.contactId));
                    const eligibleContacts = contacts.filter((c) => !alreadyRunSet.has(c.id));
                    console.log(`💤 [INACTIVITY] ${automation.name}: ${contacts.length} inactive, ` +
                        `${eligibleContacts.length} eligible (${alreadyRunSet.size} skipped)`);
                    if (eligibleContacts.length === 0)
                        continue;
                    await automation_service_1.automationService.incrementExecutionCount(automation.id);
                    // ✅ Execute sequentially with delay
                    for (const contact of eligibleContacts) {
                        try {
                            await this.executeSequence(automation.id, automation.actions, {
                                organizationId: automation.organizationId,
                                contactId: contact.id,
                                phone: contact.phone,
                            });
                            await new Promise((r) => setTimeout(r, 300));
                        }
                        catch (err) {
                            console.error(`❌ [INACTIVITY] Failed for ${contact.id}:`, err.message);
                        }
                    }
                    console.log(`✅ [INACTIVITY] Completed: ${automation.name}`);
                }
                catch (err) {
                    if (err?.code !== 'P2024') {
                        console.error(`❌ [INACTIVITY] Automation ${automation.id} failed:`, err.message);
                    }
                }
            }
        }
        catch (error) {
            if (error?.code !== 'P2024') {
                console.error('🤖 Inactivity automation trigger error:', error);
            }
        }
    }
    // ==========================================
    // ✅ COMPATIBILITY: Handle Button Click
    // ==========================================
    async handleButtonClick(context) {
        return this.handleUserResponse({
            organizationId: context.organizationId,
            contactId: context.contactId,
            response: context.buttonId,
            conversationId: context.conversationId,
        });
    }
    // ==========================================
    // ✅ EXECUTE SEQUENCE (Multi-step with wait)
    // ==========================================
    async executeSequence(automationId, actions, context) {
        console.log(`🔄 Executing sequence: ${actions.length} steps`);
        // Create or get contact
        let contactId = context.contactId;
        if (!contactId && context.phone) {
            const contact = await database_1.default.contact.upsert({
                where: {
                    organizationId_phone: {
                        organizationId: context.organizationId,
                        phone: context.phone,
                    },
                },
                create: {
                    organizationId: context.organizationId,
                    phone: context.phone,
                    countryCode: '+91',
                    firstName: 'Unknown',
                    status: 'ACTIVE',
                    source: 'WHATSAPP_AUTOMATION',
                },
                update: {},
            });
            contactId = contact.id;
        }
        if (!contactId) {
            console.error('❌ No contact ID available');
            return;
        }
        // Create sequence tracker
        await database_1.default.automationSequence.upsert({
            where: {
                automationId_contactId: {
                    automationId,
                    contactId,
                },
            },
            create: {
                automationId,
                contactId,
                currentStep: 0,
                status: 'ACTIVE',
            },
            update: {
                currentStep: 0,
                status: 'ACTIVE',
            },
        });
        // Execute actions
        for (let i = 0; i < actions.length; i++) {
            const action = actions[i];
            try {
                console.log(`🤖 Step ${i + 1}: ${action.type}`);
                // Update progress
                await database_1.default.automationSequence.updateMany({
                    where: { automationId, contactId },
                    data: { currentStep: i, lastStepAt: new Date() },
                });
                switch (action.type) {
                    case 'send_text':
                    case 'send_message':
                        await this.actionSendText({ ...context, contactId }, action.config);
                        break;
                    case 'send_audio':
                        await this.actionSendMedia({ ...context, contactId }, 'audio', action.config);
                        break;
                    case 'send_video':
                        await this.actionSendMedia({ ...context, contactId }, 'video', action.config);
                        break;
                    case 'send_image':
                        await this.actionSendMedia({ ...context, contactId }, 'image', action.config);
                        break;
                    case 'send_document':
                        await this.actionSendMedia({ ...context, contactId }, 'document', action.config);
                        break;
                    case 'send_buttons':
                        await this.actionSendButtons({ ...context, contactId }, action.config);
                        break;
                    case 'send_template':
                        await this.actionSendTemplate({ ...context, contactId }, { ...action.config, _automationId: automationId });
                        break;
                    case 'wait_for_response':
                        await this.actionWaitForResponse(automationId, contactId, action.config);
                        return; // Pause until user responds
                    case 'delay':
                        await this.actionDelay(action.config);
                        break;
                    case 'add_tag':
                        await this.actionAddTag({ ...context, contactId }, action.config);
                        break;
                    case 'add_to_group':
                        await this.actionAddToGroup({ ...context, contactId }, action.config);
                        break;
                    case 'create_lead':
                        await this.actionCreateLead({ ...context, contactId }, action.config);
                        break;
                    default:
                        console.warn(`⚠️ Unknown action: ${action.type}`);
                }
            }
            catch (error) {
                console.error(`❌ Step ${i + 1} failed:`, error.message);
            }
        }
        // Mark complete
        await database_1.default.automationSequence.updateMany({
            where: { automationId, contactId },
            data: { status: 'COMPLETED' },
        });
        await automation_service_1.automationService.incrementExecutionCount(automationId);
    }
    // ==========================================
    // ✅ ACTION: SEND TEXT
    // ==========================================
    async actionSendText(context, config) {
        const account = await this.getDefaultAccount(context.organizationId);
        if (!account || !context.phone)
            return;
        const message = await this.replaceVariables(config.text || config.message || '', context);
        await whatsapp_service_1.whatsappService.sendTextMessage(account.id, context.phone, message, context.conversationId, context.organizationId);
        console.log(`✅ Sent text to ${context.phone}`);
    }
    // ==========================================
    // ✅ ACTION: SEND MEDIA (Audio/Video/Image/Document)
    // ==========================================
    async actionSendMedia(context, mediaType, config) {
        const account = await this.getDefaultAccount(context.organizationId);
        if (!account || !context.phone)
            return;
        const mediaUrl = config.audioUrl || config.videoUrl || config.imageUrl || config.documentUrl || config.url;
        if (!mediaUrl) {
            console.warn(`⚠️ No ${mediaType} URL provided`);
            return;
        }
        await whatsapp_service_1.whatsappService.sendMediaMessage(account.id, context.phone, mediaType, mediaUrl, config.caption, context.conversationId, context.organizationId);
        console.log(`✅ Sent ${mediaType} to ${context.phone}`);
    }
    // ==========================================
    // ✅ ACTION: SEND BUTTONS (Interactive)
    // ==========================================
    async actionSendButtons(context, config) {
        const account = await this.getDefaultAccount(context.organizationId);
        if (!account || !context.phone)
            return;
        const buttons = config.buttons || [];
        if (buttons.length === 0) {
            console.warn('⚠️ No buttons configured');
            return;
        }
        const text = await this.replaceVariables(config.text || 'Please select:', context);
        const interactivePayload = {
            type: 'button',
            body: { text },
            action: {
                buttons: buttons.slice(0, 3).map((btn, i) => ({
                    type: 'reply',
                    reply: {
                        id: btn.id || `btn_${i}`,
                        title: btn.text.substring(0, 20), // Max 20 chars
                    },
                })),
            },
        };
        await whatsapp_service_1.whatsappService.sendMessage({
            accountId: account.id,
            to: context.phone,
            type: 'interactive',
            content: { interactive: interactivePayload },
            conversationId: context.conversationId,
            organizationId: context.organizationId,
        });
        console.log(`✅ Sent buttons to ${context.phone}`);
    }
    // ==========================================
    // ✅ ACTION: SEND TEMPLATE
    // ==========================================
    async actionSendTemplate(context, config) {
        if (!config.templateId) {
            console.error('❌ [send_template] templateId missing:', config);
            return;
        }
        if (!context.phone) {
            console.error('❌ [send_template] phone missing:', context);
            return;
        }
        const account = await this.getDefaultAccount(context.organizationId);
        if (!account) {
            console.error(`❌ [send_template] No WhatsApp account for org: ${context.organizationId}`);
            return;
        }
        const template = await database_1.default.template.findUnique({
            where: { id: config.templateId },
        });
        if (!template) {
            console.error(`❌ [send_template] Template not found: ${config.templateId}`);
            return;
        }
        if (template.status !== 'APPROVED') {
            console.error(`❌ [send_template] Template "${template.name}" is "${template.status}" - not APPROVED`);
            return;
        }
        console.log(`📋 [send_template] Sending: ${template.name} → ${context.phone}`);
        console.log(`📋 [send_template] Template details:`, {
            headerType: template.headerType,
            headerMediaId: template.headerMediaId,
            headerContent: template.headerContent,
        });
        // ============================================
        // ✅ LANGUAGE MAPPING
        // ============================================
        const toMetaLang = (lang) => {
            const l = String(lang || '').trim();
            if (!l)
                return 'en_US';
            if (l.includes('_') || l.length <= 3)
                return l; // Already formatted
            const mapping = {
                english: 'en_US', hindi: 'hi',
                spanish: 'es_ES', portuguese: 'pt_BR',
                french: 'fr_FR', german: 'de_DE',
                italian: 'it_IT', arabic: 'ar',
            };
            return mapping[l.toLowerCase()] || l;
        };
        // ============================================
        // ✅ HELPER FUNCTIONS
        // ============================================
        const isValidHttpUrl = (str) => {
            try {
                const url = new URL(str);
                return url.protocol === 'http:' || url.protocol === 'https:';
            }
            catch {
                return false;
            }
        };
        const isExpiredWhatsAppHandle = (str) => {
            // "4:V2hhdH..." format = upload handle (expires in ~10min)
            return /^\d+:[A-Za-z0-9+/=:_-]+$/.test(str);
        };
        const isPureIntegerId = (str) => {
            return /^\d{10,}$/.test(str);
        };
        /**
         * ✅ CORRECT media param builder
         *
         * Meta Template Send API rules:
         *   { link: "https://..." }  → Valid CDN/Cloudinary URL ✅
         *   { id: 1234567890 }       → Numeric media ID (integer) ✅
         *   { id: "4:V2hh..." }      → INVALID - upload handle ❌
         *   { link: "4:V2hh..." }    → INVALID - not a URL ❌
         */
        const buildMediaParam = (mediaType, mediaValue) => {
            const type = mediaType.toLowerCase();
            if (isValidHttpUrl(mediaValue)) {
                // ✅ Cloudinary/S3/CDN URL - best option
                console.log(`🔗 [template] Using URL for ${type}: ${mediaValue.substring(0, 60)}...`);
                return {
                    type,
                    [type]: { link: mediaValue }
                };
            }
            else if (isPureIntegerId(mediaValue)) {
                // ✅ Pure numeric ID - permanent, use as integer
                console.log(`🔢 [template] Using numeric Media ID for ${type}: ${mediaValue}`);
                return {
                    type,
                    [type]: { id: parseInt(mediaValue, 10) }
                };
            }
            else if (isExpiredWhatsAppHandle(mediaValue)) {
                // ❌ Upload handle - only valid during template CREATION, not sending
                console.error(`❌ [template] WhatsApp upload handle detected - CANNOT use for sending!`);
                console.error(`   Handle: ${mediaValue.substring(0, 50)}...`);
                console.error(`   These handles expire in ~10 min after upload.`);
                return null;
            }
            else {
                // Unknown - try as URL
                console.warn(`⚠️ [template] Unknown media format, attempting as link`);
                return {
                    type,
                    [type]: { link: mediaValue }
                };
            }
        };
        // ============================================
        // ✅ BUILD COMPONENTS - FIXED PRIORITY ORDER
        // ============================================
        let components = config.components || [];
        if (components.length === 0) {
            // ── HEADER COMPONENT ──────────────────────
            if (template.headerType && template.headerType !== 'NONE') {
                const hType = template.headerType.toUpperCase();
                if (['IMAGE', 'VIDEO', 'DOCUMENT'].includes(hType)) {
                    /**
                     * ✅ PRIORITY ORDER (Most reliable → Least reliable):
                     *
                     * 1. headerContent + isValidHttpUrl  → Cloudinary URL (PERMANENT) ✅
                     * 2. headerMediaId + isPureIntegerId → Numeric Meta ID (PERMANENT) ✅
                     * 3. Skip                            → Handle expired, can't send ❌
                     *
                     * NEVER use "4:xxx" upload handles for SENDING
                     * They are only for template CREATION (header_handle field)
                     */
                    const cloudinaryUrl = template.headerContent && isValidHttpUrl(template.headerContent)
                        ? template.headerContent
                        : null;
                    const numericId = template.headerMediaId && isPureIntegerId(template.headerMediaId)
                        ? template.headerMediaId
                        : null;
                    const mediaValue = cloudinaryUrl || numericId;
                    if (mediaValue) {
                        const mediaParam = buildMediaParam(hType.toLowerCase(), mediaValue);
                        if (mediaParam) {
                            components.push({
                                type: 'header',
                                parameters: [mediaParam]
                            });
                            console.log(`✅ [template] Header ${hType} built using: ${cloudinaryUrl ? 'Cloudinary URL' : 'Numeric ID'}`);
                        }
                    }
                    else {
                        // Both are unusable
                        console.error(`❌ [template] No valid media for ${hType} header!`);
                        console.error(`   headerContent: ${template.headerContent?.substring(0, 60) || 'null'}`);
                        console.error(`   headerMediaId: ${template.headerMediaId?.substring(0, 40) || 'null'}`);
                        console.error(`   Solution: Re-upload image in Templates page`);
                        // ❌ Template send nahi hoga - throw karo clear message ke saath
                        throw new Error(`Template "${template.name}" has expired media. ` +
                            `Please re-upload the image/video in the Templates section.`);
                    }
                }
                else if (hType === 'TEXT' && template.headerContent) {
                    // Text header - variables fill karo
                    if (template.headerContent.includes('{{1}}')) {
                        let contactName = 'Customer';
                        if (context.contactId) {
                            const contact = await database_1.default.contact.findUnique({
                                where: { id: context.contactId },
                                select: { firstName: true, lastName: true }
                            });
                            if (contact?.firstName && contact.firstName !== 'Unknown') {
                                contactName = [contact.firstName, contact.lastName]
                                    .filter(Boolean).join(' ');
                            }
                        }
                        components.push({
                            type: 'header',
                            parameters: [{ type: 'text', text: contactName }]
                        });
                    }
                    // No variables in text header = no parameters needed
                }
            }
            // ── BODY COMPONENT ────────────────────────
            const bodyText = template.bodyText || '';
            const bodyVarMatches = bodyText.match(/\{\{(\d+)\}\}/g) || [];
            if (bodyVarMatches.length > 0) {
                let contactName = 'Customer';
                if (context.contactId) {
                    const contact = await database_1.default.contact.findUnique({
                        where: { id: context.contactId },
                        select: { firstName: true, lastName: true }
                    });
                    if (contact?.firstName && contact.firstName !== 'Unknown') {
                        contactName = [contact.firstName, contact.lastName]
                            .filter(Boolean).join(' ');
                    }
                }
                const bodyParams = bodyVarMatches.map((_, i) => ({
                    type: 'text',
                    text: i === 0 ? contactName : 'Customer'
                }));
                components.push({ type: 'body', parameters: bodyParams });
            }
            // ── BUTTON COMPONENTS ─────────────────────
            if (template.buttons) {
                const buttons = typeof template.buttons === 'string'
                    ? JSON.parse(template.buttons)
                    : template.buttons;
                if (Array.isArray(buttons)) {
                    buttons.forEach((btn, index) => {
                        if (btn.type === 'URL' && btn.url?.includes('{{')) {
                            components.push({
                                type: 'button',
                                sub_type: 'url',
                                index,
                                parameters: [{ type: 'text', text: '' }]
                            });
                        }
                    });
                }
            }
        }
        console.log(`📋 [template] Final components:`, JSON.stringify(components, null, 2));
        // ============================================
        // ✅ SEND TEMPLATE
        // ============================================
        try {
            const result = await whatsapp_service_1.whatsappService.sendTemplateMessage({
                accountId: account.id,
                to: context.phone,
                templateName: template.name,
                templateLanguage: toMetaLang(template.language),
                components,
                conversationId: context.conversationId,
                organizationId: context.organizationId,
            });
            console.log(`✅ [send_template] Sent! waMessageId: ${result.waMessageId}`);
            // ✅ Wallet deduction (non-blocking)
            (0, wallet_deduction_service_1.deductWalletForTemplate)({
                organizationId: context.organizationId,
                templateName: template.name,
                templateCategory: template.category,
                recipientPhone: context.phone,
                waMessageId: result.waMessageId,
                automationId: config._automationId,
                automationName: `Automation → ${template.name}`,
            }).then(r => {
                if (r.deducted)
                    console.log(`💳 Wallet: -₹${r.amount} for automation template`);
            }).catch(e => {
                console.error('💳 Wallet deduction error (non-blocking):', e.message);
            });
        }
        catch (error) {
            console.error(`❌ [send_template] Failed "${template.name}":`, {
                error: error.message,
                phone: context.phone,
                templateId: config.templateId,
            });
            throw error;
        }
    }
    // ==========================================
    // ✅ ACTION: WAIT FOR RESPONSE
    // ==========================================
    async actionWaitForResponse(automationId, contactId, config) {
        console.log(`⏸️ Pausing sequence until user responds`);
        await database_1.default.automationSequence.updateMany({
            where: { automationId, contactId },
            data: {
                status: 'WAITING',
                metadata: {
                    waitingFor: config.buttonIds || config.keywords || [],
                    timeout: config.timeout || 24 * 60 * 60 * 1000, // 24 hours default
                },
            },
        });
    }
    // ==========================================
    // ✅ ACTION: ADD TO GROUP
    // ==========================================
    async actionAddToGroup(context, config) {
        if (!context.contactId || !config.groupId)
            return;
        await database_1.default.contactGroupMember.upsert({
            where: {
                groupId_contactId: {
                    groupId: config.groupId,
                    contactId: context.contactId,
                },
            },
            create: {
                groupId: config.groupId,
                contactId: context.contactId,
            },
            update: {},
        });
        console.log(`✅ Added contact to group: ${config.groupId}`);
    }
    // ==========================================
    // ✅ HANDLE BUTTON CLICK / RESPONSE
    // ==========================================
    async handleUserResponse(context) {
        console.log(`🔘 User response: ${context.response}`);
        try {
            // Find waiting sequence
            const sequence = await database_1.default.automationSequence.findFirst({
                where: {
                    contactId: context.contactId,
                    status: 'WAITING',
                },
                include: { automation: true },
            });
            if (!sequence) {
                console.log(`ℹ️ No waiting sequence found`);
                return;
            }
            const metadata = sequence.metadata;
            const waitingFor = metadata?.waitingFor || [];
            // Check if response matches
            const matched = waitingFor.length === 0 ||
                waitingFor.some((w) => context.response.toLowerCase().includes(w.toLowerCase()));
            if (!matched) {
                console.log(`⏭️ Response doesn't match expected: ${waitingFor}`);
                return;
            }
            // Resume sequence
            const remainingActions = sequence.automation.actions.slice(sequence.currentStep + 1);
            if (remainingActions.length > 0) {
                console.log(`🔄 Resuming from step ${sequence.currentStep + 1}`);
                await database_1.default.automationSequence.update({
                    where: { id: sequence.id },
                    data: { status: 'ACTIVE' },
                });
                await this.executeSequence(sequence.automationId, remainingActions, {
                    organizationId: context.organizationId,
                    contactId: context.contactId,
                    conversationId: context.conversationId,
                    phone: context.phone,
                });
            }
        }
        catch (error) {
            console.error('❌ Handle response error:', error);
        }
    }
    // ==========================================
    // HELPER METHODS
    // ==========================================
    async getDefaultAccount(organizationId) {
        return database_1.default.whatsAppAccount.findFirst({
            where: { organizationId, status: 'CONNECTED' },
            orderBy: { isDefault: 'desc' },
        });
    }
    async replaceVariables(text, context) {
        let result = text;
        if (context.contactId) {
            const contact = await database_1.default.contact.findUnique({
                where: { id: context.contactId },
            });
            if (contact) {
                result = result.replace(/\{\{firstName\}\}/gi, contact.firstName || '');
                result = result.replace(/\{\{lastName\}\}/gi, contact.lastName || '');
                result = result.replace(/\{\{phone\}\}/gi, contact.phone || '');
                result = result.replace(/\{\{name\}\}/gi, [contact.firstName, contact.lastName].filter(Boolean).join(' ') || 'there');
            }
        }
        result = result.replace(/\{\{date\}\}/gi, new Date().toLocaleDateString());
        result = result.replace(/\{\{time\}\}/gi, new Date().toLocaleTimeString());
        return result;
    }
    async actionDelay(config) {
        // ✅ Frontend 'value' bhejta hai, backend 'duration' expect karta tha
        const duration = config.duration || config.value || 1;
        const unit = config.unit || 'seconds';
        let ms = duration * 1000; // default: seconds
        if (unit === 'minutes')
            ms = duration * 60 * 1000;
        if (unit === 'hours')
            ms = duration * 60 * 60 * 1000;
        if (unit === 'days')
            ms = duration * 24 * 60 * 60 * 1000;
        // ✅ Production safety: max 30 seconds delay in automation engine
        // (Long delays should use scheduled jobs, not setTimeout)
        const MAX_SAFE_DELAY = 30 * 1000;
        if (ms > MAX_SAFE_DELAY) {
            console.warn(`⚠️ [delay] Requested ${duration} ${unit} (${ms}ms) exceeds max. ` +
                `Capping at ${MAX_SAFE_DELAY / 1000}s for safety.`);
            ms = MAX_SAFE_DELAY;
        }
        console.log(`⏳ [delay] Waiting ${duration} ${unit} (${ms}ms)...`);
        await new Promise((resolve) => setTimeout(resolve, ms));
        console.log(`✅ [delay] Done waiting`);
    }
    async actionAddTag(context, config) {
        if (!context.contactId) {
            console.warn('⚠️ [add_tag] No contactId in context');
            return;
        }
        // ✅ Both keys support karo - frontend 'tagName' bhejta hai
        const tagValue = config.tag || config.tagName;
        if (!tagValue) {
            console.warn('⚠️ [add_tag] No tag value. Config received:', config);
            return;
        }
        await database_1.default.contact.update({
            where: { id: context.contactId },
            data: { tags: { push: tagValue } },
        });
        console.log(`✅ [add_tag] Tag "${tagValue}" added to contact: ${context.contactId}`);
    }
    async actionCreateLead(context, config) {
        if (!context.contactId)
            return;
        const existing = await database_1.default.lead.findFirst({
            where: {
                organizationId: context.organizationId,
                contactId: context.contactId,
                status: { notIn: ['WON', 'LOST'] },
            },
        });
        if (existing) {
            console.log(`⏭️ Lead already exists`);
            return;
        }
        const pipeline = await database_1.default.pipeline.findFirst({
            where: { organizationId: context.organizationId, isDefault: true },
            include: { stages: { orderBy: { order: 'asc' }, take: 1 } },
        });
        await database_1.default.lead.create({
            data: {
                organizationId: context.organizationId,
                title: config.title || 'Automated Lead',
                contactId: context.contactId,
                pipelineId: pipeline?.id,
                stageId: pipeline?.stages[0]?.id,
                source: 'automation',
            },
        });
        console.log(`✅ Created lead`);
    }
    // Existing execute actions (keep for backward compatibility)
    async executeActions(automationId, actions, context) {
        await this.executeSequence(automationId, actions, context);
    }
}
exports.automationEngine = new AutomationEngine();
exports.default = exports.automationEngine;
//# sourceMappingURL=automation.engine.js.map
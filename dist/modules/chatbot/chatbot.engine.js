"use strict";
// src/modules/chatbot/chatbot.engine.ts
// COMPLETE REWRITE - Redis Persistent + Gemini AI + Perfect Flow
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.chatbotEngine = exports.ChatbotEngine = void 0;
const database_1 = __importDefault(require("../../config/database"));
const whatsapp_service_1 = require("../whatsapp/whatsapp.service");
const ai_service_1 = require("./ai.service");
// ============================================
// REDIS SESSION MANAGER - ioredis compatible
// ============================================
class RedisSessionManager {
    PREFIX = 'chatbot:session:';
    TTL = 24 * 60 * 60; // 24 hours in seconds
    LOCK_PREFIX = 'chatbot:lock:';
    LOCK_TTL = 30; // seconds
    // ── Get Redis Instance ───────────────────────
    getRedis() {
        const { getRedis } = require('../../config/redis');
        return getRedis();
    }
    // ── Get Session ──────────────────────────────
    async get(key) {
        try {
            const redis = this.getRedis();
            if (!redis)
                return null;
            const data = await redis.get(`${this.PREFIX}${key}`);
            if (!data)
                return null;
            return JSON.parse(data);
        }
        catch (error) {
            console.error('❌ Redis GET error:', error);
            return null;
        }
    }
    // ── Save Session ─────────────────────────────
    async set(key, session) {
        try {
            const redis = this.getRedis();
            if (!redis)
                return;
            session.lastActivityAt = Date.now();
            // ioredis: setEx(key, seconds, value)
            await redis.setex(`${this.PREFIX}${key}`, this.TTL, JSON.stringify(session));
        }
        catch (error) {
            console.error('❌ Redis SET error:', error);
        }
    }
    // ── Delete Session ───────────────────────────
    async delete(key) {
        try {
            const redis = this.getRedis();
            if (!redis)
                return;
            await redis.del(`${this.PREFIX}${key}`);
        }
        catch (error) {
            console.error('❌ Redis DEL error:', error);
        }
    }
    // ── Acquire Distributed Lock ─────────────────
    async acquireLock(key) {
        try {
            const redis = this.getRedis();
            if (!redis)
                return true; // No redis = no lock needed
            const lockKey = `${this.LOCK_PREFIX}${key}`;
            // ioredis: set with NX and EX options
            const result = await redis.set(lockKey, '1', 'EX', this.LOCK_TTL, 'NX');
            // Returns 'OK' if lock acquired, null if already locked
            return result === 'OK';
        }
        catch (error) {
            console.error('❌ Redis LOCK error:', error);
            return true; // Fail open
        }
    }
    // ── Release Lock ─────────────────────────────
    async releaseLock(key) {
        try {
            const redis = this.getRedis();
            if (!redis)
                return;
            await redis.del(`${this.LOCK_PREFIX}${key}`);
        }
        catch (error) {
            console.error('❌ Redis UNLOCK error:', error);
        }
    }
    // ── Extend TTL ───────────────────────────────
    async touch(key) {
        try {
            const redis = this.getRedis();
            if (!redis)
                return;
            await redis.expire(`${this.PREFIX}${key}`, this.TTL);
        }
        catch (error) {
            // Non-critical
        }
    }
}
const sessionManager = new RedisSessionManager();
// ============================================
// CHATBOT ENGINE - PRODUCTION GRADE
// ============================================
class ChatbotEngine {
    // ==========================================
    // MAIN ENTRY POINT
    // ==========================================
    async processMessage(conversationId, organizationId, messageContent, senderPhone, isNewConversation, rawMessage) {
        const sessionKey = `${organizationId}:${conversationId}`;
        const cleanMessage = (messageContent || '').trim();
        console.log(`\n🤖 ═══════ CHATBOT ENGINE ═══════`);
        console.log(`   Msg    : "${cleanMessage}"`);
        console.log(`   New    : ${isNewConversation}`);
        // ✅ FIXED: Lock with retry instead of silent drop
        let lockAcquired = false;
        let lockRetries = 3;
        while (!lockAcquired && lockRetries > 0) {
            lockAcquired = await sessionManager.acquireLock(sessionKey);
            if (!lockAcquired) {
                lockRetries--;
                if (lockRetries > 0) {
                    await this.sleep(500); // Wait and retry
                    console.log(`🔒 Lock retry... (${lockRetries} left)`);
                }
            }
        }
        if (!lockAcquired) {
            console.log(`🔒 Could not acquire lock after retries, skipping`);
            return;
        }
        try {
            let session = await sessionManager.get(sessionKey);
            console.log(`   Session: ${session
                ? `FOUND (node: ${session.currentNodeId}, AI: ${session.aiNodeActive})`
                : 'NEW'}`);
            // ✅ FIXED: isNewConversation check improved
            // If existing session exists and AI is active - NEVER reset
            const shouldReset = isNewConversation &&
                !session?.aiNodeActive && // AI not active
                !session?.waitingForInput; // Not waiting for any input
            let chatbot = await this.findMatchingChatbot(organizationId, cleanMessage, isNewConversation || !session, // New if no session
            session?.chatbotId);
            // Stale session cleanup
            if (!chatbot && session && !session.aiNodeActive) {
                console.log(`⚠️ Stale session, clearing...`);
                await sessionManager.delete(sessionKey);
                session = null;
                chatbot = await this.findMatchingChatbot(organizationId, cleanMessage, true, undefined);
            }
            // ✅ AI active session - use same chatbot
            if (!chatbot && session?.aiNodeActive) {
                chatbot = await database_1.default.chatbot.findFirst({
                    where: {
                        id: session.chatbotId,
                        organizationId,
                        status: 'ACTIVE'
                    }
                });
            }
            if (!chatbot) {
                console.log(`🤖 No active chatbot found`);
                return;
            }
            const flowData = chatbot.flowData;
            if (!flowData?.nodes?.length) {
                console.log(`🤖 Empty flow`);
                return;
            }
            const account = await database_1.default.whatsAppAccount.findFirst({
                where: { organizationId, status: 'CONNECTED' },
                orderBy: { isDefault: 'desc' },
            });
            if (!account) {
                console.error(`❌ No connected WhatsApp account`);
                return;
            }
            // ✅ FIXED: Session decision logic
            if (!session || shouldReset) {
                // Need to create new session
                session = await this.createNewSession(chatbot, organizationId, conversationId, senderPhone, cleanMessage, flowData, account, sessionKey, chatbot.welcomeMessage || '', rawMessage);
                if (!session)
                    return;
            }
            else {
                // Continue existing session
                session = await this.handleExistingSession(session, cleanMessage, flowData, organizationId, conversationId, senderPhone, account, sessionKey, chatbot);
            }
            // Save session
            await sessionManager.set(sessionKey, session);
            // Execute flow
            if (!session.waitingForInput) {
                await this.executeFlow(session, flowData, account, conversationId, organizationId, senderPhone, sessionKey, chatbot.fallbackMessage || '');
            }
        }
        catch (error) {
            console.error(`❌ Chatbot engine error:`, error);
        }
        finally {
            await sessionManager.releaseLock(sessionKey);
            console.log(`🤖 ═══════ ENGINE END ═══════\n`);
        }
    }
    // ==========================================
    // CREATE NEW SESSION
    // ==========================================
    async createNewSession(chatbot, organizationId, conversationId, senderPhone, message, flowData, account, sessionKey, welcomeMessage, rawMessage) {
        console.log(`🆕 Creating new session for: ${chatbot.name}`);
        // Send welcome message
        if (welcomeMessage) {
            await this.sendText(account, senderPhone, welcomeMessage, conversationId, organizationId);
            await this.sleep(600);
        }
        // Find start node
        const startNode = flowData.nodes.find(n => n.type === 'start');
        if (!startNode) {
            console.error(`❌ No start node found`);
            return null;
        }
        const firstNodeId = this.getNextNodeId(startNode.id, flowData);
        if (!firstNodeId) {
            console.error(`❌ Start node not connected`);
            return null;
        }
        const session = {
            chatbotId: chatbot.id,
            organizationId,
            conversationId,
            senderPhone,
            currentNodeId: firstNodeId,
            waitingForInput: false,
            expectedInputType: 'any',
            variables: {
                phone: senderPhone,
                conversationId,
                message,
                userName: 'Guest',
                startTime: new Date().toISOString(),
                leadScore: 0, // ✅ NEW
                leadCreated: false, // ✅ NEW
                // ✅ Ad tracking (webhook se inject hoga)
                adSource: rawMessage?.referral?.source || '',
                adId: rawMessage?.referral?.ad_id || '',
                campaignId: rawMessage?.referral?.ads_context_data?.ad_title || '',
            },
            chatHistory: [],
            startedAt: Date.now(),
            lastActivityAt: Date.now(),
            messageCount: 0,
            aiNodeActive: false,
        };
        return session;
    }
    // ==========================================
    // HANDLE EXISTING SESSION - FIXED
    // ==========================================
    async handleExistingSession(session, input, flowData, organizationId, conversationId, senderPhone, account, sessionKey, chatbot) {
        console.log(`🔄 Resuming session at: ${session.currentNodeId}`);
        console.log(`   AI Active: ${session.aiNodeActive}`);
        console.log(`   Waiting: ${session.waitingForInput}`);
        session.messageCount++;
        // ✅ ALWAYS store input - NEVER lose it
        session.variables['previousInput'] = session.variables['lastInput'] || '';
        session.variables['lastInput'] = input;
        session.variables['message'] = input;
        // ✅ CASE 1: AI Node Active - Direct AI processing
        // Perform this check FIRST - before waitingForInput
        if (session.aiNodeActive) {
            console.log(`🤖 AI mode active - routing to AI node directly`);
            session.waitingForInput = false;
            // currentNodeId will remain on the AI node
            return session;
        }
        // ✅ CASE 2: Waiting for input - process it
        if (session.waitingForInput) {
            session = await this.processUserInput(session, input, flowData);
            return session;
        }
        // ✅ CASE 3: Not waiting, not AI - check for new keyword
        const newChatbot = await this.findMatchingChatbot(organizationId, input, false, undefined);
        if (newChatbot && newChatbot.id !== session.chatbotId) {
            console.log(`🔀 New chatbot keyword matched: ${newChatbot.name}`);
            await sessionManager.delete(sessionKey);
            // ✅ Recursive call - create new session
            await this.processMessage(conversationId, organizationId, input, senderPhone, true);
            // Stop current execution
            session.waitingForInput = true;
            session.aiNodeActive = false;
            return session;
        }
        // ✅ CASE 4: Session active, no special state
        // Continue flow from current node
        session.waitingForInput = false;
        return session;
    }
    // ==========================================
    // PROCESS USER INPUT - FIXED
    // ==========================================
    async processUserInput(session, input, flowData) {
        const currentNode = flowData.nodes.find(n => n.id === session.currentNodeId);
        if (!currentNode) {
            console.warn(`⚠️ Node not found: ${session.currentNodeId}`);
            session.waitingForInput = false;
            return session;
        }
        console.log(`🎯 Processing input for node type: [${currentNode.type}]`);
        console.log(`   Input: "${input.substring(0, 50)}"`);
        switch (currentNode.type) {
            case 'button': {
                session = this.matchButtonInput(session, input, currentNode, flowData);
                break;
            }
            case 'list': {
                session = this.matchListInput(session, input, currentNode, flowData);
                break;
            }
            case 'message': {
                if (currentNode.data.waitForInput) {
                    // ✅ Get variable name from label
                    const varName = currentNode.data.label
                        ?.toLowerCase()
                        .replace(/\s+/g, '_') || 'userInput';
                    session.variables[varName] = input;
                    session.variables['lastInput'] = input; // ✅ Keep lastInput
                    const nextId = this.getNextNodeId(currentNode.id, flowData);
                    if (nextId) {
                        session.currentNodeId = nextId;
                        console.log(`➡️ Message node → next: ${nextId}`);
                    }
                    session.waitingForInput = false;
                }
                break;
            }
            case 'ai': {
                // ✅ AI node - input already stored in lastInput
                // Just set waitingForInput = false, AI will execute
                session.waitingForInput = false;
                session.aiNodeActive = true;
                console.log(`🤖 AI node: input ready for processing`);
                break;
            }
            default: {
                session.waitingForInput = false;
                break;
            }
        }
        return session;
    }
    // ==========================================
    // INTEREST KEYWORDS - Auto Detection
    // ==========================================
    INTEREST_SIGNALS = [
        // High intent
        'price', 'pricing', 'cost', 'rate', 'charge', 'fee', 'fees',
        'buy', 'purchase', 'order', 'book', 'booking',
        'demo', 'trial', 'start', 'begin', 'join',
        'interested', 'interest', 'yes', 'haan', 'ha',
        'call', 'callback', 'contact', 'connect',
        'consult', 'consultation', 'appointment',
        'enroll', 'admission', 'register', 'registration',
        'quote', 'proposal', 'plan',
        // Hindi
        'kharidna', 'chahiye', 'lena', 'batao', 'bataiye',
        'milega', 'milegi', 'kaisa', 'kitna',
    ];
    DISINTEREST_SIGNALS = [
        'no', 'nahi', 'nope', 'not', 'cancel', 'stop',
        'bye', 'exit', 'quit', 'leave',
        'not interested', 'exploring', 'just looking',
        'baad mein', 'later', 'abhi nahi',
    ];
    // ==========================================
    // AUTO DETECT INTEREST FROM BUTTON/LIST
    // ==========================================
    detectInterestFromInput(text, score = 0) {
        const lower = text.toLowerCase().trim();
        // Check disinterest first
        for (const signal of this.DISINTEREST_SIGNALS) {
            if (lower.includes(signal)) {
                return {
                    isInterested: false,
                    scoreBoost: 0,
                    reason: `disinterest_signal: ${signal}`,
                };
            }
        }
        // Check interest signals
        for (const signal of this.INTEREST_SIGNALS) {
            if (lower.includes(signal)) {
                return {
                    isInterested: true,
                    scoreBoost: 25,
                    reason: `interest_signal: ${signal}`,
                };
            }
        }
        // Score based
        if (score >= 50) {
            return {
                isInterested: true,
                scoreBoost: 0,
                reason: 'score_threshold',
            };
        }
        // Default - neutral button click still shows some interest
        return {
            isInterested: false,
            scoreBoost: 10, // Small boost for any engagement
            reason: 'neutral_engagement',
        };
    }
    // ==========================================
    // AUTO CREATE INTERESTED LEAD
    // ✅ Ye automatically call hoga jab interest detect ho
    // ==========================================
    async autoCreateInterestedLead(session) {
        try {
            // Already lead bana chuka hai toh skip
            if (session.variables['leadCreated']) {
                console.log(`⏭️ Lead already created, skipping auto-create`);
                return;
            }
            const contact = await this.findContact(session.organizationId, session.senderPhone);
            if (!contact) {
                console.warn('⚠️ Auto lead: contact not found');
                return;
            }
            const { crmService } = await Promise.resolve().then(() => __importStar(require('../crm/crm.service')));
            const result = await crmService.smartCreateLead({
                organizationId: session.organizationId,
                contactId: contact.id,
                conversationId: session.conversationId,
                source: session.variables['adSource']
                    ? 'whatsapp_ad'
                    : 'chatbot_auto',
                score: Number(session.variables['leadScore'] || 25),
                chatbotQualified: true,
                serviceInterest: session.variables['selectedButton']
                    || session.variables['selectedOption']
                    || session.variables['serviceInterest']
                    || undefined,
                budget: session.variables['budget'] || undefined,
                city: session.variables['city'] || undefined,
                adSource: session.variables['adSource'] || undefined,
                adId: session.variables['adId'] || undefined,
                qualificationData: {
                    selectedButton: session.variables['selectedButton'],
                    selectedOption: session.variables['selectedOption'],
                    interestReason: session.variables['interestReason'],
                    leadScore: session.variables['leadScore'],
                    chatbotId: session.chatbotId,
                    autoDetected: true,
                    detectedAt: new Date().toISOString(),
                },
            });
            // Session mein mark karo
            session.variables['leadCreated'] = true;
            session.variables['leadId'] = result.lead.id;
            session.variables['leadAction'] = result.action;
            console.log(`🎯 Auto Lead ${result.action}: ${result.lead.id} ` +
                `(score: ${session.variables['leadScore']})`);
        }
        catch (error) {
            console.error('❌ autoCreateInterestedLead failed:', error);
        }
    }
    // ==========================================
    // BUTTON INPUT MATCHING
    // ==========================================
    matchButtonInput(session, input, node, flowData) {
        const buttons = node.data.buttons || [];
        const inputLower = input.toLowerCase().trim();
        let matchedButton = null;
        // Strategy 1: Exact ID match
        matchedButton = buttons.find(b => b.id === input) || null;
        // Strategy 2: Exact text match
        if (!matchedButton) {
            matchedButton = buttons.find(b => b.text.toLowerCase().trim() === inputLower) || null;
        }
        // Strategy 3: Contains match
        if (!matchedButton) {
            matchedButton = buttons.find(b => inputLower.includes(b.text.toLowerCase().trim()) ||
                b.text.toLowerCase().trim().includes(inputLower)) || null;
        }
        // Strategy 4: Number match
        if (!matchedButton) {
            const num = parseInt(input);
            if (!isNaN(num) && num >= 1 && num <= buttons.length) {
                matchedButton = buttons[num - 1];
            }
        }
        if (matchedButton) {
            console.log(`✅ Button matched: "${matchedButton.text}"`);
            session.variables['selectedButton'] = matchedButton.text;
            session.variables['selectedButtonId'] = matchedButton.id;
            // ✅ AUTO INTEREST DETECTION
            const currentScore = Number(session.variables['leadScore'] || 0);
            const detection = this.detectInterestFromInput(matchedButton.text, currentScore);
            // Update score
            const newScore = Math.min(100, currentScore + detection.scoreBoost);
            session.variables['leadScore'] = newScore;
            if (detection.isInterested) {
                session.variables['userInterested'] = true;
                session.variables['interestReason'] = detection.reason;
                console.log(`🎯 Interest detected! Score: ${currentScore} → ${newScore}`);
                // ✅ Auto trigger lead creation (non-blocking)
                this.autoCreateInterestedLead(session).catch(e => console.error('Auto lead creation error:', e));
            }
            else if (detection.scoreBoost > 0) {
                console.log(`📊 Engagement score: ${currentScore} → ${newScore}`);
            }
            // Find next node
            const edge = this.findButtonEdge(node.id, matchedButton, input, flowData);
            if (edge) {
                session.currentNodeId = edge.target;
                console.log(`➡️ Moving to: ${edge.target}`);
            }
            else {
                const anyEdge = flowData.edges.find(e => e.source === node.id);
                if (anyEdge) {
                    session.currentNodeId = anyEdge.target;
                    console.log(`➡️ Fallback edge: ${anyEdge.target}`);
                }
            }
        }
        else {
            console.log(`❌ No button matched for: "${input}"`);
        }
        session.waitingForInput = false;
        return session;
    }
    // ==========================================
    // LIST INPUT MATCHING
    // ==========================================
    matchListInput(session, input, node, flowData) {
        const sections = node.data.listSections || [];
        let allRows = [];
        sections.forEach(s => {
            if (s.rows)
                allRows = allRows.concat(s.rows);
        });
        const inputLower = input.toLowerCase().trim();
        let matchedRow = null;
        // Strategy 1: Exact ID match
        matchedRow = allRows.find(r => r.id === input) || null;
        // Strategy 2: Exact title match
        if (!matchedRow) {
            matchedRow = allRows.find(r => r.title.toLowerCase().trim() === inputLower) || null;
        }
        // Strategy 3: Contains match
        if (!matchedRow) {
            matchedRow = allRows.find(r => inputLower.includes(r.title.toLowerCase().trim()) ||
                r.title.toLowerCase().trim().includes(inputLower)) || null;
        }
        // Strategy 4: Number match
        if (!matchedRow) {
            const num = parseInt(input);
            if (!isNaN(num) && num >= 1 && num <= allRows.length) {
                matchedRow = allRows[num - 1];
            }
        }
        if (matchedRow) {
            console.log(`✅ List matched: "${matchedRow.title}"`);
            session.variables['selectedOption'] = matchedRow.title;
            session.variables['selectedOptionId'] = matchedRow.id;
            // ✅ AUTO INTEREST DETECTION
            const currentScore = Number(session.variables['leadScore'] || 0);
            const detection = this.detectInterestFromInput(matchedRow.title, currentScore);
            const newScore = Math.min(100, currentScore + detection.scoreBoost);
            session.variables['leadScore'] = newScore;
            if (detection.isInterested) {
                session.variables['userInterested'] = true;
                session.variables['interestReason'] = detection.reason;
                console.log(`🎯 Interest detected from list! Score: ${newScore}`);
                this.autoCreateInterestedLead(session).catch(e => console.error('Auto lead creation error:', e));
            }
            const edge = this.findListEdge(node.id, matchedRow, input, flowData);
            if (edge) {
                session.currentNodeId = edge.target;
            }
            else {
                const anyEdge = flowData.edges.find(e => e.source === node.id);
                if (anyEdge)
                    session.currentNodeId = anyEdge.target;
            }
        }
        session.waitingForInput = false;
        return session;
    }
    // ==========================================
    // EXECUTE FLOW - Main Loop
    // ==========================================
    async executeFlow(session, flowData, account, conversationId, organizationId, senderPhone, sessionKey, fallbackMessage, depth = 0) {
        // ✅ Infinite loop protection
        if (depth > 30) {
            console.error(`🔴 Max depth reached - infinite loop protection`);
            return;
        }
        const node = flowData.nodes.find(n => n.id === session.currentNodeId);
        if (!node) {
            console.log(`⚠️ Node not found: ${session.currentNodeId}`);
            if (fallbackMessage) {
                await this.sendText(account, senderPhone, fallbackMessage, conversationId, organizationId);
            }
            await sessionManager.delete(sessionKey);
            return;
        }
        console.log(`▶️ Executing [${node.type}] id:${node.id} depth:${depth}`);
        switch (node.type) {
            // ──────────────────────────────────────
            case 'start': {
                const nextId = this.getNextNodeId(node.id, flowData);
                if (nextId) {
                    session.currentNodeId = nextId;
                    await sessionManager.set(sessionKey, session);
                    await this.executeFlow(session, flowData, account, conversationId, organizationId, senderPhone, sessionKey, fallbackMessage, depth + 1);
                }
                break;
            }
            // ──────────────────────────────────────
            case 'message': {
                await this.executeMessageNode(node, session, flowData, account, conversationId, organizationId, senderPhone, sessionKey, fallbackMessage, depth);
                break;
            }
            // ──────────────────────────────────────
            case 'button': {
                await this.executeButtonNode(node, session, account, conversationId, organizationId, senderPhone, sessionKey);
                break;
            }
            // ──────────────────────────────────────
            case 'list': {
                await this.executeListNode(node, session, account, conversationId, organizationId, senderPhone, sessionKey);
                break;
            }
            // ──────────────────────────────────────
            case 'condition': {
                await this.executeConditionNode(node, session, flowData, account, conversationId, organizationId, senderPhone, sessionKey, fallbackMessage, depth);
                break;
            }
            // ──────────────────────────────────────
            case 'delay': {
                const delayMs = Math.min(node.data.delay || 1000, 10000);
                console.log(`⏱️ Delay: ${delayMs}ms`);
                await this.sleep(delayMs);
                const nextId = this.getNextNodeId(node.id, flowData);
                if (nextId) {
                    session.currentNodeId = nextId;
                    await sessionManager.set(sessionKey, session);
                    await this.executeFlow(session, flowData, account, conversationId, organizationId, senderPhone, sessionKey, fallbackMessage, depth + 1);
                }
                break;
            }
            // ──────────────────────────────────────
            case 'action': {
                await this.executeAction(node.data.action, session, organizationId, senderPhone, conversationId);
                const nextId = this.getNextNodeId(node.id, flowData);
                if (nextId) {
                    session.currentNodeId = nextId;
                    await sessionManager.set(sessionKey, session);
                    await this.executeFlow(session, flowData, account, conversationId, organizationId, senderPhone, sessionKey, fallbackMessage, depth + 1);
                }
                break;
            }
            // ──────────────────────────────────────
            case 'ai': {
                await this.executeAINode(node, session, flowData, account, conversationId, organizationId, senderPhone, sessionKey, fallbackMessage, depth);
                break;
            }
            // ──────────────────────────────────────
            case 'end': {
                console.log(`🏁 Flow completed`);
                await sessionManager.delete(sessionKey);
                break;
            }
            default: {
                console.log(`❓ Unknown node type: ${node.type}`);
                const nextId = this.getNextNodeId(node.id, flowData);
                if (nextId) {
                    session.currentNodeId = nextId;
                    await sessionManager.set(sessionKey, session);
                    await this.executeFlow(session, flowData, account, conversationId, organizationId, senderPhone, sessionKey, fallbackMessage, depth + 1);
                }
            }
        }
    }
    // ==========================================
    // MESSAGE NODE
    // ==========================================
    async executeMessageNode(node, session, flowData, account, conversationId, organizationId, senderPhone, sessionKey, fallbackMessage, depth) {
        const text = this.replaceVariables(node.data.message || '', session.variables);
        const messageType = node.data.messageType || 'text';
        const mediaUrl = node.data.mediaUrl;
        // Send message
        if (messageType === 'text' && text) {
            await this.sendText(account, senderPhone, text, conversationId, organizationId);
        }
        else if (['image', 'video', 'document', 'audio'].includes(messageType) &&
            mediaUrl) {
            try {
                await whatsapp_service_1.whatsappService.sendMediaMessage(account.id, senderPhone, messageType, mediaUrl, text || undefined, conversationId, organizationId, undefined, undefined);
            }
            catch (err) {
                console.error(`❌ Media send failed:`, err);
                if (text) {
                    await this.sendText(account, senderPhone, text, conversationId, organizationId);
                }
            }
        }
        // waitForInput check
        if (node.data.waitForInput) {
            console.log(`⏸️ Message node: waiting for user input`);
            session.waitingForInput = true;
            session.expectedInputType = 'text';
            await sessionManager.set(sessionKey, session);
            return;
        }
        // Auto-advance
        await this.sleep(500);
        const nextId = this.getNextNodeId(node.id, flowData);
        if (nextId) {
            session.currentNodeId = nextId;
            await sessionManager.set(sessionKey, session);
            await this.executeFlow(session, flowData, account, conversationId, organizationId, senderPhone, sessionKey, fallbackMessage, depth + 1);
        }
        else {
            await sessionManager.delete(sessionKey);
        }
    }
    // ==========================================
    // BUTTON NODE
    // ==========================================
    async executeButtonNode(node, session, account, conversationId, organizationId, senderPhone, sessionKey) {
        const text = this.replaceVariables(node.data.message || 'Please choose an option:', session.variables);
        const buttons = node.data.buttons || [];
        if (buttons.length === 0) {
            await this.sendText(account, senderPhone, text, conversationId, organizationId);
            return;
        }
        // ✅ Try WhatsApp interactive buttons first
        const sent = await this.sendButtonMessage(account, senderPhone, text, buttons, conversationId, organizationId);
        // Fallback to numbered text
        if (!sent) {
            const numbered = `${text}\n\n${buttons
                .map((b, i) => `${i + 1}. ${b.text}`)
                .join('\n')}`;
            await this.sendText(account, senderPhone, numbered, conversationId, organizationId);
        }
        // Wait for user selection
        session.waitingForInput = true;
        session.expectedInputType = 'button';
        session.expectedButtons = buttons;
        await sessionManager.set(sessionKey, session);
    }
    // ==========================================
    // LIST NODE
    // ==========================================
    async executeListNode(node, session, account, conversationId, organizationId, senderPhone, sessionKey) {
        const text = this.replaceVariables(node.data.message || 'Please select an option:', session.variables);
        const listButtonText = node.data.listButtonText || 'Options';
        const sections = node.data.listSections || [];
        if (sections.length === 0) {
            await this.sendText(account, senderPhone, text, conversationId, organizationId);
            return;
        }
        const sent = await this.sendListMessage(account, senderPhone, text, listButtonText, sections, conversationId, organizationId);
        if (!sent) {
            let rows = [];
            sections.forEach(s => {
                if (s.rows)
                    rows = rows.concat(s.rows);
            });
            const numbered = `${text}\n\n${rows
                .map((r, i) => `${i + 1}. ${r.title}`)
                .join('\n')}`;
            await this.sendText(account, senderPhone, numbered, conversationId, organizationId);
        }
        session.waitingForInput = true;
        session.expectedInputType = 'list';
        await sessionManager.set(sessionKey, session);
    }
    // ==========================================
    // CONDITION NODE
    // ==========================================
    async executeConditionNode(node, session, flowData, account, conversationId, organizationId, senderPhone, sessionKey, fallbackMessage, depth) {
        const result = this.evaluateCondition(node.data.condition, session.variables);
        console.log(`🔀 Condition: ${JSON.stringify(node.data.condition)} = ${result}`);
        const handleId = result ? 'true' : 'false';
        let edge = flowData.edges.find(e => e.source === node.id &&
            (e.sourceHandle === handleId ||
                e.label?.toLowerCase() === handleId));
        // Fallback
        if (!edge) {
            edge = flowData.edges.find(e => e.source === node.id);
        }
        if (edge) {
            session.currentNodeId = edge.target;
            await sessionManager.set(sessionKey, session);
            await this.executeFlow(session, flowData, account, conversationId, organizationId, senderPhone, sessionKey, fallbackMessage, depth + 1);
        }
    }
    // ==========================================
    // AI NODE - Gemini Powered
    // ==========================================
    // ==========================================
    // AI NODE - FIXED (Most Important)
    // ==========================================
    async executeAINode(node, session, flowData, account, conversationId, organizationId, senderPhone, sessionKey, fallbackMessage, depth) {
        const systemPrompt = node.data.systemPrompt ||
            'You are a helpful WhatsApp business assistant.';
        // ✅ FIXED: Retrieve input from multiple sources
        const userMessage = (session.variables['lastInput'] ||
            session.variables['message'] ||
            session.variables['previousInput'] ||
            '').trim();
        console.log(`🤖 AI Node executing`);
        console.log(`   Message: "${userMessage.substring(0, 50)}"`);
        console.log(`   History: ${session.chatHistory.length} messages`);
        // ✅ FIXED: First time at AI node - send welcome message
        if (!userMessage && !session.aiNodeActive) {
            console.log(`⏸️ AI node: first time - waiting for user`);
            // If the node contains a message, send it
            if (node.data.message) {
                await this.sendText(account, senderPhone, node.data.message, conversationId, organizationId);
            }
            session.waitingForInput = true;
            session.aiNodeActive = true;
            session.currentNodeId = node.id; // ✅ Stay on the AI node
            session.expectedInputType = 'text';
            await sessionManager.set(sessionKey, session);
            return;
        }
        // ✅ No message - still waiting
        if (!userMessage) {
            session.waitingForInput = true;
            session.aiNodeActive = true;
            session.currentNodeId = node.id;
            await sessionManager.set(sessionKey, session);
            return;
        }
        console.log(`🤖 AI processing: "${userMessage.substring(0, 50)}"`);
        // ✅ FIXED: Smart history management
        // Summarize after 30 messages (not 15)
        if (session.chatHistory.length > 30) {
            const summary = await ai_service_1.aiService.summarizeConversation(session.chatHistory.slice(0, -10) // Keep last 10
            );
            if (summary) {
                session.conversationSummary = summary;
                session.chatHistory = session.chatHistory.slice(-10); // Keep last 10 messages
                console.log(`📝 History summarized, keeping last 10`);
            }
        }
        // ✅ FIXED: Rich system prompt with context
        const enhancedPrompt = this.buildEnhancedSystemPrompt(systemPrompt, session);
        // ✅ Generate AI response
        let aiResponse;
        try {
            aiResponse = await ai_service_1.aiService.generateResponse(enhancedPrompt, userMessage, session.chatHistory);
        }
        catch (error) {
            console.error('❌ AI generation failed:', error);
            aiResponse = fallbackMessage ||
                'I apologize, but I did not understand that. Please try again.';
        }
        // ✅ FIXED: Add to history BEFORE clearing lastInput
        session.chatHistory.push({
            role: 'user',
            content: userMessage,
            timestamp: Date.now(),
        });
        session.chatHistory.push({
            role: 'model',
            content: aiResponse,
            timestamp: Date.now(),
        });
        // ✅ Variables update
        session.variables['aiLastResponse'] = aiResponse;
        session.variables['lastInput'] = ''; // Clear after use
        session.variables['previousInput'] = userMessage; // Keep reference
        // Send response
        await this.sendText(account, senderPhone, aiResponse, conversationId, organizationId);
        // ✅ FIXED: Next node check
        const nextId = this.getNextNodeId(node.id, flowData);
        if (nextId) {
            // ✅ Has next node - check if it's another AI node or end
            const nextNode = flowData.nodes.find(n => n.id === nextId);
            if (nextNode?.type === 'end') {
                // Flow ended
                session.currentNodeId = nextId;
                session.aiNodeActive = false;
                session.waitingForInput = false;
                await sessionManager.set(sessionKey, session);
                await this.executeFlow(session, flowData, account, conversationId, organizationId, senderPhone, sessionKey, fallbackMessage, depth + 1);
            }
            else if (nextNode?.type === 'condition') {
                // Evaluate condition
                session.currentNodeId = nextId;
                session.aiNodeActive = false;
                session.waitingForInput = false;
                await sessionManager.set(sessionKey, session);
                await this.executeFlow(session, flowData, account, conversationId, organizationId, senderPhone, sessionKey, fallbackMessage, depth + 1);
            }
            else {
                // ✅ Other node - continue flow
                session.currentNodeId = nextId;
                session.aiNodeActive = false;
                session.waitingForInput = false;
                await sessionManager.set(sessionKey, session);
                await this.sleep(300);
                await this.executeFlow(session, flowData, account, conversationId, organizationId, senderPhone, sessionKey, fallbackMessage, depth + 1);
            }
        }
        else {
            // ✅ FIXED: Stay on AI node
            session.waitingForInput = true;
            session.aiNodeActive = true;
            session.currentNodeId = node.id; // ✅ Stay on the AI node
            session.expectedInputType = 'text';
            await sessionManager.set(sessionKey, session);
            console.log(`🤖 AI staying in conversation mode at node: ${node.id}`);
        }
    }
    // ==========================================
    // NEW: Enhanced System Prompt Builder
    // ==========================================
    buildEnhancedSystemPrompt(systemPrompt, session) {
        let enhanced = systemPrompt;
        // ✅ Add previous summary
        if (session.conversationSummary) {
            enhanced += `\n\n[Conversation History Summary]: ${session.conversationSummary}`;
        }
        // ✅ Add known variables (for context)
        const relevantVars = Object.entries(session.variables)
            .filter(([key, val]) => val &&
            !['lastInput', 'previousInput', 'aiLastResponse', 'message'].includes(key) &&
            typeof val === 'string' &&
            val.length < 200)
            .map(([key, val]) => `${key}: ${val}`)
            .join(', ');
        if (relevantVars) {
            enhanced += `\n\n[User Context]: ${relevantVars}`;
        }
        // ✅ Message count context
        if (session.messageCount > 5) {
            enhanced += `\n\n[Note]: This is an ongoing conversation (${session.messageCount} messages). Maintain continuity.`;
        }
        return enhanced;
    }
    // ==========================================
    // FIND CHATBOT
    // ==========================================
    async findMatchingChatbot(organizationId, messageContent, isNewConversation, existingChatbotId) {
        // Use existing session's chatbot
        if (existingChatbotId) {
            const bot = await database_1.default.chatbot.findFirst({
                where: {
                    id: existingChatbotId,
                    organizationId,
                    status: 'ACTIVE'
                },
            });
            if (bot) {
                console.log(`🔄 Using session chatbot: ${bot.name}`);
                return bot;
            }
        }
        const allActive = await database_1.default.chatbot.findMany({
            where: { organizationId, status: 'ACTIVE' },
        });
        if (!allActive.length)
            return null;
        const lowerMsg = messageContent.toLowerCase().trim();
        // 1. Exact keyword match
        for (const bot of allActive) {
            const keywords = bot.triggerKeywords || [];
            const match = keywords.find(kw => kw.toLowerCase().trim() === lowerMsg);
            if (match) {
                console.log(`🎯 Exact keyword: "${match}" → ${bot.name}`);
                return bot;
            }
        }
        // 2. Partial keyword match
        for (const bot of allActive) {
            const keywords = bot.triggerKeywords || [];
            const match = keywords.find(kw => {
                const kwLower = kw.toLowerCase().trim();
                return lowerMsg.includes(kwLower) || kwLower.includes(lowerMsg);
            });
            if (match) {
                console.log(`🎯 Partial keyword: "${match}" → ${bot.name}`);
                return bot;
            }
        }
        // 3. New conversation → default bot
        if (isNewConversation) {
            const defaultBot = allActive.find(b => b.isDefault);
            if (defaultBot) {
                console.log(`🏠 Default bot: ${defaultBot.name}`);
                return defaultBot;
            }
            if (allActive.length === 1)
                return allActive[0];
        }
        return null;
    }
    // ==========================================
    // SEND HELPERS
    // ==========================================
    async sendText(account, to, text, conversationId, organizationId) {
        if (!text?.trim())
            return;
        try {
            await whatsapp_service_1.whatsappService.sendTextMessage(account.id, to, text, conversationId, organizationId, undefined, undefined, true // skipWindowCheck
            );
            console.log(`📤 Sent: "${text.substring(0, 60)}..."`);
        }
        catch (error) {
            console.error(`❌ sendText error:`, error);
        }
    }
    async sendButtonMessage(account, to, text, buttons, conversationId, organizationId) {
        try {
            const validButtons = buttons
                .slice(0, 3)
                .filter(b => b.text?.trim())
                .map(b => ({
                type: 'reply',
                reply: {
                    id: b.id || `btn_${Date.now()}`,
                    title: b.text.trim().substring(0, 20),
                },
            }));
            if (!validButtons.length)
                return false;
            await whatsapp_service_1.whatsappService.sendMessage({
                accountId: account.id,
                to,
                type: 'interactive',
                content: {
                    interactive: {
                        type: 'button',
                        body: { text: text.substring(0, 1024) },
                        action: { buttons: validButtons },
                    },
                },
                conversationId,
                organizationId,
                skipWindowCheck: true,
            });
            console.log(`📤 Buttons sent: ${validButtons.length}`);
            return true;
        }
        catch (error) {
            console.error(`❌ Button send failed:`, error);
            return false;
        }
    }
    async sendListMessage(account, to, text, buttonText, sections, conversationId, organizationId) {
        try {
            const validSections = sections
                .filter(s => s.rows?.length > 0)
                .slice(0, 10)
                .map(s => ({
                title: s.title?.substring(0, 24),
                rows: s.rows.slice(0, 10).map(r => ({
                    id: r.id,
                    title: r.title.substring(0, 24),
                    description: r.description?.substring(0, 72),
                })),
            }));
            if (!validSections.length)
                return false;
            await whatsapp_service_1.whatsappService.sendMessage({
                accountId: account.id,
                to,
                type: 'interactive',
                content: {
                    interactive: {
                        type: 'list',
                        body: { text: text.substring(0, 1024) },
                        action: {
                            button: buttonText.substring(0, 20),
                            sections: validSections,
                        },
                    },
                },
                conversationId,
                organizationId,
                skipWindowCheck: true,
            });
            console.log(`📤 List sent`);
            return true;
        }
        catch (error) {
            console.error(`❌ List send failed:`, error);
            return false;
        }
    }
    // ==========================================
    // EDGE FINDERS
    // ==========================================
    findButtonEdge(nodeId, button, rawInput, flowData) {
        const edges = flowData.edges.filter(e => e.source === nodeId);
        // Priority order
        return (edges.find(e => e.sourceHandle === rawInput) || // Raw input ID
            edges.find(e => e.sourceHandle === button.id) || // Button ID
            edges.find(e => e.sourceHandle === button.text) || // Button text
            edges.find(e => e.label === button.text) || // Edge label
            edges.find(e => e.label === button.id) || // Edge label = id
            edges.find(e => // Case insensitive
             e.label?.toLowerCase() === button.text.toLowerCase()) ||
            null);
    }
    findListEdge(nodeId, row, rawInput, flowData) {
        const edges = flowData.edges.filter(e => e.source === nodeId);
        return (edges.find(e => e.sourceHandle === rawInput) ||
            edges.find(e => e.sourceHandle === row.id) ||
            edges.find(e => e.sourceHandle === row.title) ||
            edges.find(e => e.label === row.title) ||
            edges.find(e => e.label === row.id) ||
            edges.find(e => e.label?.toLowerCase() === row.title.toLowerCase()) ||
            null);
    }
    getNextNodeId(nodeId, flowData) {
        // Prefer edge without sourceHandle (main flow)
        const defaultEdge = flowData.edges.find(e => e.source === nodeId && !e.sourceHandle);
        if (defaultEdge)
            return defaultEdge.target;
        // Any edge
        const anyEdge = flowData.edges.find(e => e.source === nodeId);
        return anyEdge?.target || null;
    }
    // ==========================================
    // EXECUTE ACTION
    // ==========================================
    async executeAction(action, session, organizationId, phone, conversationId) {
        if (!action)
            return;
        console.log(`⚡ Action: ${action.type}`);
        try {
            switch (action.type) {
                // ─────────────────────────────────────────
                case 'tagContact': {
                    const tag = action.params?.tag;
                    if (!tag)
                        break;
                    const contact = await this.findContact(organizationId, phone);
                    if (contact) {
                        await database_1.default.contact.update({
                            where: { id: contact.id },
                            data: { tags: { push: tag } },
                        });
                        session.variables[`tagged_${tag}`] = true;
                        console.log(`🏷️ Tagged: ${tag}`);
                    }
                    break;
                }
                // ─────────────────────────────────────────
                case 'setVariable': {
                    const { name, value } = action.params || {};
                    if (name) {
                        session.variables[name] = value;
                        console.log(`📝 Variable: ${name} = ${value}`);
                    }
                    break;
                }
                // ─────────────────────────────────────────
                // ✅ NEW: Add score to lead qualification
                case 'addScore': {
                    const points = Number(action.params?.points || 0);
                    const currentScore = Number(session.variables['leadScore'] || 0);
                    const newScore = Math.min(100, currentScore + points);
                    session.variables['leadScore'] = newScore;
                    console.log(`📊 Score: ${currentScore} + ${points} = ${newScore}`);
                    // ✅ Check SCORE_BASED mode
                    const contact = await this.findContact(organizationId, phone);
                    if (contact) {
                        const { crmService } = await Promise.resolve().then(() => __importStar(require('../crm/crm.service')));
                        const created = await crmService.checkAndCreateLeadByScore(organizationId, contact.id, newScore, {
                            conversationId,
                            qualificationData: session.variables,
                            source: 'chatbot_score',
                        });
                        if (created) {
                            session.variables['leadCreated'] = true;
                            console.log(`🎯 Lead auto-created by score threshold`);
                        }
                    }
                    break;
                }
                // ─────────────────────────────────────────
                // ✅ UPGRADED: Smart createLead
                case 'createLead': {
                    const contact = await this.findContact(organizationId, phone);
                    if (!contact) {
                        console.warn('⚠️ createLead: contact not found');
                        break;
                    }
                    const { crmService } = await Promise.resolve().then(() => __importStar(require('../crm/crm.service')));
                    const result = await crmService.smartCreateLead({
                        organizationId,
                        contactId: contact.id,
                        conversationId,
                        title: action.params?.title
                            ? this.replaceVariables(action.params.title, session.variables)
                            : undefined,
                        source: action.params?.source || 'chatbot',
                        score: Number(session.variables['leadScore'] || 0),
                        priority: action.params?.priority || undefined,
                        serviceInterest: session.variables['serviceInterest']
                            || session.variables['service']
                            || action.params?.serviceInterest
                            || undefined,
                        budget: session.variables['budget']
                            || action.params?.budget
                            || undefined,
                        city: session.variables['city']
                            || action.params?.city
                            || undefined,
                        adSource: session.variables['adSource'] || undefined,
                        adId: session.variables['adId'] || undefined,
                        chatbotQualified: true,
                        qualificationData: {
                            ...session.variables,
                            chatbotId: session.chatbotId,
                            completedAt: new Date().toISOString(),
                        },
                        notes: action.params?.notes
                            ? this.replaceVariables(action.params.notes, session.variables)
                            : undefined,
                    });
                    session.variables['leadCreated'] = true;
                    session.variables['leadId'] = result.lead.id;
                    session.variables['leadAction'] = result.action;
                    console.log(`💼 Lead ${result.action}: ${result.lead.id}`);
                    break;
                }
                // ─────────────────────────────────────────
                // ✅ NEW: Update lead stage
                case 'updateLeadStage': {
                    const leadId = session.variables['leadId'];
                    if (!leadId || !action.params?.stageId)
                        break;
                    await database_1.default.lead.update({
                        where: { id: leadId },
                        data: {
                            stageId: action.params.stageId,
                            lastActivityAt: new Date(),
                        },
                    });
                    console.log(`📈 Lead stage updated`);
                    break;
                }
                // ─────────────────────────────────────────
                // ✅ NEW: Assign lead to user
                case 'assignLead': {
                    const leadId = session.variables['leadId'];
                    if (!leadId || !action.params?.userId)
                        break;
                    await database_1.default.lead.update({
                        where: { id: leadId },
                        data: {
                            assignedToId: action.params.userId,
                            lastActivityAt: new Date(),
                        },
                    });
                    console.log(`👤 Lead assigned to: ${action.params.userId}`);
                    break;
                }
                // ─────────────────────────────────────────
                case 'webhook': {
                    const { url, method = 'POST' } = action.params || {};
                    if (!url)
                        break;
                    const controller = new AbortController();
                    const timeout = setTimeout(() => controller.abort(), 5000);
                    try {
                        await fetch(url, {
                            method,
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                phone,
                                organizationId,
                                conversationId,
                                variables: session.variables,
                                leadScore: session.variables['leadScore'],
                                leadId: session.variables['leadId'],
                                timestamp: new Date().toISOString(),
                            }),
                            signal: controller.signal,
                        });
                    }
                    finally {
                        clearTimeout(timeout);
                    }
                    break;
                }
            }
        }
        catch (error) {
            console.error(`❌ Action "${action.type}" error:`, error);
        }
    }
    // ✅ NEW Helper: Find contact by phone
    async findContact(organizationId, phone) {
        const phone10 = phone.replace(/\D/g, '').slice(-10);
        return database_1.default.contact.findFirst({
            where: {
                organizationId,
                OR: [
                    { phone: phone10 },
                    { phone: `+91${phone10}` },
                    { phone: `91${phone10}` },
                    { phone },
                ],
            },
        });
    }
    // ==========================================
    // EVALUATE CONDITION
    // ==========================================
    evaluateCondition(condition, variables) {
        if (!condition)
            return true;
        const { variable, operator, value } = condition;
        const varVal = String(variables[variable] ?? '').toLowerCase().trim();
        const cmpVal = String(value ?? '').toLowerCase().trim();
        switch (operator) {
            case 'equals':
            case '=':
                return varVal === cmpVal;
            case 'not_equals':
            case '!=':
                return varVal !== cmpVal;
            case 'contains':
                return varVal.includes(cmpVal);
            case 'not_contains':
                return !varVal.includes(cmpVal);
            case 'starts_with':
            case 'startsWith':
                return varVal.startsWith(cmpVal);
            case 'ends_with':
            case 'endsWith':
                return varVal.endsWith(cmpVal);
            case 'greater_than':
                return Number(varVal) > Number(cmpVal);
            case 'less_than':
                return Number(varVal) < Number(cmpVal);
            case 'is_empty':
                return !varVal;
            case 'is_not_empty':
            case 'exists':
                return !!varVal;
            default:
                console.warn(`❓ Unknown operator: ${operator}`);
                return false;
        }
    }
    // ==========================================
    // VARIABLE REPLACEMENT
    // ==========================================
    replaceVariables(text, variables) {
        return text.replace(/\{\{(\w+)\}\}/g, (_, key) => {
            return variables[key] !== undefined
                ? String(variables[key])
                : `{{${key}}}`;
        });
    }
    // ==========================================
    // SLEEP
    // ==========================================
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    // ==========================================
    // PUBLIC METHODS
    // ==========================================
    // Human takeover - session clear karo
    async clearSession(organizationId, conversationId) {
        const key = `${organizationId}:${conversationId}`;
        await sessionManager.delete(key);
        console.log(`🤖 Session cleared: ${key}`);
    }
    // Session info
    async getSessionInfo(organizationId, conversationId) {
        const key = `${organizationId}:${conversationId}`;
        const session = await sessionManager.get(key);
        if (!session)
            return null;
        return {
            chatbotId: session.chatbotId,
            currentNodeId: session.currentNodeId,
            waitingForInput: session.waitingForInput,
            expectedInputType: session.expectedInputType,
            messageCount: session.messageCount,
            aiNodeActive: session.aiNodeActive,
            historyLength: session.chatHistory.length,
            startedAt: new Date(session.startedAt),
            lastActivityAt: new Date(session.lastActivityAt),
        };
    }
}
exports.ChatbotEngine = ChatbotEngine;
exports.chatbotEngine = new ChatbotEngine();
//# sourceMappingURL=chatbot.engine.js.map
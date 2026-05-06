// src/modules/chatbot/chatbot.engine.ts
// COMPLETE REWRITE - Redis Persistent + Gemini AI + Perfect Flow

import prisma from '../../config/database';
import { whatsappService } from '../whatsapp/whatsapp.service';
import { aiService } from './ai.service';
import { getRedis } from '../../config/redis';

// ============================================
// TYPES
// ============================================
interface FlowNode {
  id: string;
  type: 'start' | 'message' | 'button' | 'list' | 'condition' 
      | 'delay' | 'action' | 'ai' | 'end';
  data: {
    label?: string;
    message?: string;
    buttons?: Array<{ id: string; text: string }>;
    listButtonText?: string;
    listSections?: Array<{
      title?: string;
      rows: Array<{ 
        id: string; 
        title: string; 
        description?: string 
      }>;
    }>;
    mediaUrl?: string;
    messageType?: string;
    systemPrompt?: string;
    condition?: {
      variable: string;
      operator: string;
      value: string;
    };
    delay?: number;
    action?: {
      type: string;
      params: Record<string, any>;
    };
    waitForInput?: boolean;
  };
  position: { x: number; y: number };
}

interface FlowEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string;
  label?: string;
}

interface FlowData {
  nodes: FlowNode[];
  edges: FlowEdge[];
}

interface ChatMessage {
  role: 'user' | 'model';
  content: string;
  timestamp: number;
}

interface ChatSession {
  // Identity
  chatbotId: string;
  organizationId: string;
  conversationId: string;
  senderPhone: string;

  // Flow State
  currentNodeId: string;
  waitingForInput: boolean;
  expectedInputType: 'text' | 'button' | 'list' | 'any';

  // Data
  variables: Record<string, any>;
  chatHistory: ChatMessage[];
  conversationSummary?: string;

  // Button/List tracking
  expectedButtons?: Array<{ id: string; text: string }>;

  // Meta
  startedAt: number;
  lastActivityAt: number;
  messageCount: number;
  aiNodeActive: boolean;
}

// ============================================
// REDIS SESSION MANAGER - ioredis compatible
// ============================================
class RedisSessionManager {
  private readonly PREFIX = 'chatbot:session:';
  private readonly TTL = 24 * 60 * 60; // 24 hours in seconds
  private readonly LOCK_PREFIX = 'chatbot:lock:';
  private readonly LOCK_TTL = 30; // seconds

  // ── Get Redis Instance ───────────────────────
  private getRedis() {
    const { getRedis } = require('../../config/redis');
    return getRedis();
  }

  // ── Get Session ──────────────────────────────
  async get(key: string): Promise<ChatSession | null> {
    try {
      const redis = this.getRedis();
      if (!redis) return null;

      const data = await redis.get(`${this.PREFIX}${key}`);
      if (!data) return null;

      return JSON.parse(data) as ChatSession;
    } catch (error) {
      console.error('❌ Redis GET error:', error);
      return null;
    }
  }

  // ── Save Session ─────────────────────────────
  async set(key: string, session: ChatSession): Promise<void> {
    try {
      const redis = this.getRedis();
      if (!redis) return;

      session.lastActivityAt = Date.now();

      // ioredis: setEx(key, seconds, value)
      await redis.setex(
        `${this.PREFIX}${key}`,
        this.TTL,
        JSON.stringify(session)
      );
    } catch (error) {
      console.error('❌ Redis SET error:', error);
    }
  }

  // ── Delete Session ───────────────────────────
  async delete(key: string): Promise<void> {
    try {
      const redis = this.getRedis();
      if (!redis) return;

      await redis.del(`${this.PREFIX}${key}`);
    } catch (error) {
      console.error('❌ Redis DEL error:', error);
    }
  }

  // ── Acquire Distributed Lock ─────────────────
  async acquireLock(key: string): Promise<boolean> {
    try {
      const redis = this.getRedis();
      if (!redis) return true; // No redis = no lock needed

      const lockKey = `${this.LOCK_PREFIX}${key}`;

      // ioredis: set with NX and EX options
      const result = await redis.set(
        lockKey,
        '1',
        'EX',
        this.LOCK_TTL,
        'NX'
      );

      // Returns 'OK' if lock acquired, null if already locked
      return result === 'OK';
    } catch (error) {
      console.error('❌ Redis LOCK error:', error);
      return true; // Fail open
    }
  }

  // ── Release Lock ─────────────────────────────
  async releaseLock(key: string): Promise<void> {
    try {
      const redis = this.getRedis();
      if (!redis) return;

      await redis.del(`${this.LOCK_PREFIX}${key}`);
    } catch (error) {
      console.error('❌ Redis UNLOCK error:', error);
    }
  }

  // ── Extend TTL ───────────────────────────────
  async touch(key: string): Promise<void> {
    try {
      const redis = this.getRedis();
      if (!redis) return;

      await redis.expire(`${this.PREFIX}${key}`, this.TTL);
    } catch (error) {
      // Non-critical
    }
  }
}

const sessionManager = new RedisSessionManager();

// ============================================
// CHATBOT ENGINE - PRODUCTION GRADE
// ============================================
export class ChatbotEngine {

  // ==========================================
  // MAIN ENTRY POINT
  // ==========================================
  async processMessage(
    conversationId: string,
    organizationId: string,
    messageContent: string,
    senderPhone: string,
    isNewConversation: boolean
  ): Promise<void> {

    const sessionKey = `${organizationId}:${conversationId}`;
    const cleanMessage = (messageContent || '').trim();

    console.log(`\n🤖 ═══════ CHATBOT ENGINE ═══════`);
    console.log(`   Msg    : "${cleanMessage}"`);
    console.log(`   Phone  : ${senderPhone}`);
    console.log(`   New    : ${isNewConversation}`);
    console.log(`   Key    : ${sessionKey}`);

    // ✅ Distributed lock - prevent duplicate processing
    const locked = await sessionManager.acquireLock(sessionKey);
    if (!locked) {
      console.log(`🔒 Session locked, skipping duplicate message`);
      return;
    }

    try {
      // 1. Load existing session from Redis
      let session = await sessionManager.get(sessionKey);
      console.log(`   Session: ${session ? `FOUND (node: ${session.currentNodeId})` : 'NEW'}`);

      // 2. Find matching chatbot
      let chatbot = await this.findMatchingChatbot(
        organizationId,
        cleanMessage,
        isNewConversation,
        session?.chatbotId
      );

      // Stale session cleanup
      if (!chatbot && session) {
        console.log(`⚠️ Stale session found, clearing...`);
        await sessionManager.delete(sessionKey);
        session = null;
        chatbot = await this.findMatchingChatbot(
          organizationId, cleanMessage, true, undefined
        );
      }

      if (!chatbot) {
        console.log(`🤖 No active chatbot found`);
        return;
      }

      const flowData = chatbot.flowData as unknown as FlowData;
      if (!flowData?.nodes?.length) {
        console.log(`🤖 Chatbot "${chatbot.name}" has empty flow`);
        return;
      }

      // 3. Get WhatsApp account
      const account = await prisma.whatsAppAccount.findFirst({
        where: { organizationId, status: 'CONNECTED' },
        orderBy: { isDefault: 'desc' },
      });

      if (!account) {
        console.error(`❌ No connected WhatsApp account`);
        return;
      }

      // 4. Session management
      if (!session || isNewConversation) {
        // ── NEW SESSION ────────────────────────
        session = await this.createNewSession(
          chatbot, organizationId, conversationId,
          senderPhone, cleanMessage, flowData,
          account, sessionKey, chatbot.welcomeMessage || ''
        );

        if (!session) return;

      } else {
        // ── EXISTING SESSION ───────────────────
        session = await this.handleExistingSession(
          session, cleanMessage, flowData,
          organizationId, conversationId,
          senderPhone, account, sessionKey,
          chatbot
        );
      }

      // 5. Save session
      await sessionManager.set(sessionKey, session);

      // 6. Execute flow if not waiting
      if (!session.waitingForInput) {
        await this.executeFlow(
          session, flowData, account,
          conversationId, organizationId,
          senderPhone, sessionKey,
          chatbot.fallbackMessage || ''
        );
      }

    } catch (error) {
      console.error(`❌ Chatbot engine error:`, error);
    } finally {
      await sessionManager.releaseLock(sessionKey);
      console.log(`🤖 ═══════ ENGINE END ═══════\n`);
    }
  }

  // ==========================================
  // CREATE NEW SESSION
  // ==========================================
  private async createNewSession(
    chatbot: any,
    organizationId: string,
    conversationId: string,
    senderPhone: string,
    message: string,
    flowData: FlowData,
    account: any,
    sessionKey: string,
    welcomeMessage: string
  ): Promise<ChatSession | null> {

    console.log(`🆕 Creating new session for: ${chatbot.name}`);

    // Send welcome message
    if (welcomeMessage) {
      await this.sendText(
        account, senderPhone,
        welcomeMessage,
        conversationId, organizationId
      );
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

    const session: ChatSession = {
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
  // HANDLE EXISTING SESSION
  // ==========================================
  private async handleExistingSession(
    session: ChatSession,
    input: string,
    flowData: FlowData,
    organizationId: string,
    conversationId: string,
    senderPhone: string,
    account: any,
    sessionKey: string,
    chatbot: any
  ): Promise<ChatSession> {

    console.log(`🔄 Resuming session at: ${session.currentNodeId}`);
    session.messageCount++;
    session.variables['lastInput'] = input;
    session.variables['message'] = input;

    if (session.waitingForInput) {
      // Process user input
      session = await this.processUserInput(session, input, flowData);
    } else {
      // Session active but not waiting
      // Check keyword for different chatbot
      const newChatbot = await this.findMatchingChatbot(
        organizationId, input, false, undefined
      );

      if (newChatbot && newChatbot.id !== session.chatbotId) {
        console.log(`🔀 New chatbot keyword matched, resetting session`);
        await sessionManager.delete(sessionKey);
        await this.processMessage(
          conversationId, organizationId,
          input, senderPhone, true
        );
        // Return old session to prevent double execution
        session.waitingForInput = true; // Prevent execution
        return session;
      }

      // AI node check - agar AI mode mein hai
      if (session.aiNodeActive) {
        console.log(`🤖 AI mode active, processing as AI input`);
        session.waitingForInput = false;
      } else if (chatbot.fallbackMessage) {
        await this.sendText(
          account, senderPhone,
          chatbot.fallbackMessage,
          conversationId, organizationId
        );
        session.waitingForInput = true; // Stay paused
      }
    }

    return session;
  }

  // ==========================================
  // PROCESS USER INPUT
  // Button, List, Text handling
  // ==========================================
  private async processUserInput(
    session: ChatSession,
    input: string,
    flowData: FlowData
  ): Promise<ChatSession> {

    const currentNode = flowData.nodes.find(
      n => n.id === session.currentNodeId
    );

    if (!currentNode) {
      session.waitingForInput = false;
      return session;
    }

    console.log(`🎯 Processing input for node: [${currentNode.type}]`);

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
          // Store input aur move to next
          const varName = currentNode.data.label || 'lastInput';
          session.variables[varName] = input;
          session.variables['lastInput'] = input;

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
        // AI node: user ne reply diya
        session.variables['lastInput'] = input;
        session.waitingForInput = false;
        session.aiNodeActive = true;
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
  // BUTTON INPUT MATCHING
  // ==========================================
  private matchButtonInput(
    session: ChatSession,
    input: string,
    node: FlowNode,
    flowData: FlowData
  ): ChatSession {

    const buttons = node.data.buttons || [];
    const inputLower = input.toLowerCase().trim();
    let matchedButton: { id: string; text: string } | null = null;

    // Strategy 1: Exact ID match (WhatsApp sends button_reply.id)
    matchedButton = buttons.find(b => b.id === input) || null;

    // Strategy 2: Exact text match
    if (!matchedButton) {
      matchedButton = buttons.find(
        b => b.text.toLowerCase().trim() === inputLower
      ) || null;
    }

    // Strategy 3: Contains match
    if (!matchedButton) {
      matchedButton = buttons.find(
        b => inputLower.includes(b.text.toLowerCase().trim()) ||
          b.text.toLowerCase().trim().includes(inputLower)
      ) || null;
    }

    // Strategy 4: Number match (1, 2, 3)
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

      // Find edge by multiple strategies
      const edge = this.findButtonEdge(
        node.id, matchedButton, input, flowData
      );

      if (edge) {
        session.currentNodeId = edge.target;
        console.log(`➡️ Moving to: ${edge.target}`);
      } else {
        // Fallback: first edge from this node
        const anyEdge = flowData.edges.find(e => e.source === node.id);
        if (anyEdge) {
          session.currentNodeId = anyEdge.target;
          console.log(`➡️ Fallback edge: ${anyEdge.target}`);
        }
      }
    } else {
      console.log(`❌ No button matched for: "${input}"`);
      // Don't change node - user ko re-prompt karo
    }

    session.waitingForInput = false;
    return session;
  }

  // ==========================================
  // LIST INPUT MATCHING
  // ==========================================
  private matchListInput(
    session: ChatSession,
    input: string,
    node: FlowNode,
    flowData: FlowData
  ): ChatSession {

    const sections = node.data.listSections || [];
    let allRows: Array<{ id: string; title: string }> = [];
    sections.forEach(s => {
      if (s.rows) allRows = allRows.concat(s.rows);
    });

    const inputLower = input.toLowerCase().trim();
    let matchedRow: { id: string; title: string } | null = null;

    // Strategy 1: Exact ID match (WhatsApp sends list_reply.id)
    matchedRow = allRows.find(r => r.id === input) || null;

    // Strategy 2: Exact title match
    if (!matchedRow) {
      matchedRow = allRows.find(
        r => r.title.toLowerCase().trim() === inputLower
      ) || null;
    }

    // Strategy 3: Contains match
    if (!matchedRow) {
      matchedRow = allRows.find(
        r => inputLower.includes(r.title.toLowerCase().trim()) ||
          r.title.toLowerCase().trim().includes(inputLower)
      ) || null;
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

      const edge = this.findListEdge(
        node.id, matchedRow, input, flowData
      );

      if (edge) {
        session.currentNodeId = edge.target;
        console.log(`➡️ Moving to: ${edge.target}`);
      } else {
        const anyEdge = flowData.edges.find(e => e.source === node.id);
        if (anyEdge) {
          session.currentNodeId = anyEdge.target;
        }
      }
    }

    session.waitingForInput = false;
    return session;
  }

  // ==========================================
  // EXECUTE FLOW - Main Loop
  // ==========================================
  private async executeFlow(
    session: ChatSession,
    flowData: FlowData,
    account: any,
    conversationId: string,
    organizationId: string,
    senderPhone: string,
    sessionKey: string,
    fallbackMessage: string,
    depth = 0
  ): Promise<void> {

    // ✅ Infinite loop protection
    if (depth > 30) {
      console.error(`🔴 Max depth reached - infinite loop protection`);
      return;
    }

    const node = flowData.nodes.find(n => n.id === session.currentNodeId);

    if (!node) {
      console.log(`⚠️ Node not found: ${session.currentNodeId}`);
      if (fallbackMessage) {
        await this.sendText(
          account, senderPhone,
          fallbackMessage, conversationId, organizationId
        );
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
          await this.executeFlow(
            session, flowData, account,
            conversationId, organizationId,
            senderPhone, sessionKey,
            fallbackMessage, depth + 1
          );
        }
        break;
      }

      // ──────────────────────────────────────
      case 'message': {
        await this.executeMessageNode(
          node, session, flowData, account,
          conversationId, organizationId,
          senderPhone, sessionKey,
          fallbackMessage, depth
        );
        break;
      }

      // ──────────────────────────────────────
      case 'button': {
        await this.executeButtonNode(
          node, session, account,
          conversationId, organizationId,
          senderPhone, sessionKey
        );
        break;
      }

      // ──────────────────────────────────────
      case 'list': {
        await this.executeListNode(
          node, session, account,
          conversationId, organizationId,
          senderPhone, sessionKey
        );
        break;
      }

      // ──────────────────────────────────────
      case 'condition': {
        await this.executeConditionNode(
          node, session, flowData, account,
          conversationId, organizationId,
          senderPhone, sessionKey,
          fallbackMessage, depth
        );
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
          await this.executeFlow(
            session, flowData, account,
            conversationId, organizationId,
            senderPhone, sessionKey,
            fallbackMessage, depth + 1
          );
        }
        break;
      }

      // ──────────────────────────────────────
      case 'action': {
        await this.executeAction(
          node.data.action, session,
          organizationId, senderPhone, conversationId
        );

        const nextId = this.getNextNodeId(node.id, flowData);
        if (nextId) {
          session.currentNodeId = nextId;
          await sessionManager.set(sessionKey, session);
          await this.executeFlow(
            session, flowData, account,
            conversationId, organizationId,
            senderPhone, sessionKey,
            fallbackMessage, depth + 1
          );
        }
        break;
      }

      // ──────────────────────────────────────
      case 'ai': {
        await this.executeAINode(
          node, session, flowData, account,
          conversationId, organizationId,
          senderPhone, sessionKey,
          fallbackMessage, depth
        );
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
          await this.executeFlow(
            session, flowData, account,
            conversationId, organizationId,
            senderPhone, sessionKey,
            fallbackMessage, depth + 1
          );
        }
      }
    }
  }

  // ==========================================
  // MESSAGE NODE
  // ==========================================
  private async executeMessageNode(
    node: FlowNode,
    session: ChatSession,
    flowData: FlowData,
    account: any,
    conversationId: string,
    organizationId: string,
    senderPhone: string,
    sessionKey: string,
    fallbackMessage: string,
    depth: number
  ): Promise<void> {

    const text = this.replaceVariables(
      node.data.message || '', session.variables
    );
    const messageType = node.data.messageType || 'text';
    const mediaUrl = node.data.mediaUrl;

    // Send message
    if (messageType === 'text' && text) {
      await this.sendText(
        account, senderPhone, text,
        conversationId, organizationId
      );
    } else if (
      ['image', 'video', 'document', 'audio'].includes(messageType) &&
      mediaUrl
    ) {
      try {
        await whatsappService.sendMediaMessage(
          account.id, senderPhone,
          messageType as any, mediaUrl,
          text || undefined,
          conversationId, organizationId,
          undefined, undefined
        );
      } catch (err) {
        console.error(`❌ Media send failed:`, err);
        if (text) {
          await this.sendText(
            account, senderPhone, text,
            conversationId, organizationId
          );
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
      await this.executeFlow(
        session, flowData, account,
        conversationId, organizationId,
        senderPhone, sessionKey,
        fallbackMessage, depth + 1
      );
    } else {
      await sessionManager.delete(sessionKey);
    }
  }

  // ==========================================
  // BUTTON NODE
  // ==========================================
  private async executeButtonNode(
    node: FlowNode,
    session: ChatSession,
    account: any,
    conversationId: string,
    organizationId: string,
    senderPhone: string,
    sessionKey: string
  ): Promise<void> {

    const text = this.replaceVariables(
      node.data.message || 'Please choose an option:',
      session.variables
    );
    const buttons = node.data.buttons || [];

    if (buttons.length === 0) {
      await this.sendText(
        account, senderPhone, text,
        conversationId, organizationId
      );
      return;
    }

    // ✅ Try WhatsApp interactive buttons first
    const sent = await this.sendButtonMessage(
      account, senderPhone, text, buttons,
      conversationId, organizationId
    );

    // Fallback to numbered text
    if (!sent) {
      const numbered = `${text}\n\n${buttons
        .map((b, i) => `${i + 1}. ${b.text}`)
        .join('\n')}`;
      await this.sendText(
        account, senderPhone, numbered,
        conversationId, organizationId
      );
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
  private async executeListNode(
    node: FlowNode,
    session: ChatSession,
    account: any,
    conversationId: string,
    organizationId: string,
    senderPhone: string,
    sessionKey: string
  ): Promise<void> {

    const text = this.replaceVariables(
      node.data.message || 'Please select an option:',
      session.variables
    );
    const listButtonText = node.data.listButtonText || 'Options';
    const sections = node.data.listSections || [];

    if (sections.length === 0) {
      await this.sendText(
        account, senderPhone, text,
        conversationId, organizationId
      );
      return;
    }

    const sent = await this.sendListMessage(
      account, senderPhone, text,
      listButtonText, sections,
      conversationId, organizationId
    );

    if (!sent) {
      let rows: Array<{ title: string }> = [];
      sections.forEach(s => {
        if (s.rows) rows = rows.concat(s.rows);
      });
      const numbered = `${text}\n\n${rows
        .map((r, i) => `${i + 1}. ${r.title}`)
        .join('\n')}`;
      await this.sendText(
        account, senderPhone, numbered,
        conversationId, organizationId
      );
    }

    session.waitingForInput = true;
    session.expectedInputType = 'list';
    await sessionManager.set(sessionKey, session);
  }

  // ==========================================
  // CONDITION NODE
  // ==========================================
  private async executeConditionNode(
    node: FlowNode,
    session: ChatSession,
    flowData: FlowData,
    account: any,
    conversationId: string,
    organizationId: string,
    senderPhone: string,
    sessionKey: string,
    fallbackMessage: string,
    depth: number
  ): Promise<void> {

    const result = this.evaluateCondition(
      node.data.condition, session.variables
    );
    console.log(`🔀 Condition: ${JSON.stringify(node.data.condition)} = ${result}`);

    const handleId = result ? 'true' : 'false';

    let edge = flowData.edges.find(
      e => e.source === node.id &&
        (e.sourceHandle === handleId ||
          e.label?.toLowerCase() === handleId)
    );

    // Fallback
    if (!edge) {
      edge = flowData.edges.find(e => e.source === node.id);
    }

    if (edge) {
      session.currentNodeId = edge.target;
      await sessionManager.set(sessionKey, session);
      await this.executeFlow(
        session, flowData, account,
        conversationId, organizationId,
        senderPhone, sessionKey,
        fallbackMessage, depth + 1
      );
    }
  }

  // ==========================================
  // AI NODE - Gemini Powered
  // ==========================================
  private async executeAINode(
    node: FlowNode,
    session: ChatSession,
    flowData: FlowData,
    account: any,
    conversationId: string,
    organizationId: string,
    senderPhone: string,
    sessionKey: string,
    fallbackMessage: string,
    depth: number
  ): Promise<void> {

    const systemPrompt = node.data.systemPrompt ||
      'You are a helpful WhatsApp business assistant.';

    const userMessage = (
      session.variables['lastInput'] ||
      session.variables['message'] ||
      ''
    ).trim();

    if (!userMessage) {
      console.log(`⏸️ AI node: waiting for first user message`);
      session.waitingForInput = true;
      session.aiNodeActive = true;
      session.expectedInputType = 'text';
      await sessionManager.set(sessionKey, session);
      return;
    }

    console.log(`🤖 AI processing: "${userMessage.substring(0, 50)}"`);

    // ✅ Summarize if history too long (>15 messages)
    if (session.chatHistory.length > 15) {
      const summary = await aiService.summarizeConversation(
        session.chatHistory
      );
      if (summary) {
        session.conversationSummary = summary;
        // Keep only last 6 messages
        session.chatHistory = session.chatHistory.slice(-6);
        console.log(`📝 History summarized`);
      }
    }

    // Build enhanced system prompt with summary
    let enhancedPrompt = systemPrompt;
    if (session.conversationSummary) {
      enhancedPrompt += `\n\nPrevious conversation summary: ${session.conversationSummary}`;
    }

    // ✅ Generate AI response with Gemini
    const aiResponse = await aiService.generateResponse(
      enhancedPrompt,
      userMessage,
      session.chatHistory
    );

    // ✅ Update history
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

    // Clear lastInput
    session.variables['lastInput'] = '';
    session.variables['aiLastResponse'] = aiResponse;

    // Send to user
    await this.sendText(
      account, senderPhone,
      aiResponse, conversationId, organizationId
    );

    // Check next node
    const nextId = this.getNextNodeId(node.id, flowData);
    if (nextId) {
      // Has next node - move forward
      session.currentNodeId = nextId;
      session.aiNodeActive = false;
      session.waitingForInput = false;
      await sessionManager.set(sessionKey, session);
      await this.sleep(300);
      await this.executeFlow(
        session, flowData, account,
        conversationId, organizationId,
        senderPhone, sessionKey,
        fallbackMessage, depth + 1
      );
    } else {
      // ✅ No next node = stay in AI conversation mode
      session.waitingForInput = true;
      session.aiNodeActive = true;
      session.expectedInputType = 'text';
      await sessionManager.set(sessionKey, session);
      console.log(`🤖 AI staying in conversation mode`);
    }
  }

  // ==========================================
  // FIND CHATBOT
  // ==========================================
  private async findMatchingChatbot(
    organizationId: string,
    messageContent: string,
    isNewConversation: boolean,
    existingChatbotId?: string
  ) {
    // Use existing session's chatbot
    if (existingChatbotId) {
      const bot = await prisma.chatbot.findFirst({
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

    const allActive = await prisma.chatbot.findMany({
      where: { organizationId, status: 'ACTIVE' },
    });

    if (!allActive.length) return null;

    const lowerMsg = messageContent.toLowerCase().trim();

    // 1. Exact keyword match
    for (const bot of allActive) {
      const keywords = (bot.triggerKeywords as string[]) || [];
      const match = keywords.find(
        kw => kw.toLowerCase().trim() === lowerMsg
      );
      if (match) {
        console.log(`🎯 Exact keyword: "${match}" → ${bot.name}`);
        return bot;
      }
    }

    // 2. Partial keyword match
    for (const bot of allActive) {
      const keywords = (bot.triggerKeywords as string[]) || [];
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
      if (allActive.length === 1) return allActive[0];
    }

    return null;
  }

  // ==========================================
  // SEND HELPERS
  // ==========================================
  private async sendText(
    account: any,
    to: string,
    text: string,
    conversationId: string,
    organizationId: string
  ): Promise<void> {
    if (!text?.trim()) return;
    try {
      await whatsappService.sendTextMessage(
        account.id, to, text,
        conversationId, organizationId,
        undefined, undefined,
        true // skipWindowCheck
      );
      console.log(`📤 Sent: "${text.substring(0, 60)}..."`);
    } catch (error) {
      console.error(`❌ sendText error:`, error);
    }
  }

  private async sendButtonMessage(
    account: any,
    to: string,
    text: string,
    buttons: Array<{ id: string; text: string }>,
    conversationId: string,
    organizationId: string
  ): Promise<boolean> {
    try {
      const validButtons = buttons
        .slice(0, 3)
        .filter(b => b.text?.trim())
        .map(b => ({
          type: 'reply' as const,
          reply: {
            id: b.id || `btn_${Date.now()}`,
            title: b.text.trim().substring(0, 20),
          },
        }));

      if (!validButtons.length) return false;

      await whatsappService.sendMessage({
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
    } catch (error) {
      console.error(`❌ Button send failed:`, error);
      return false;
    }
  }

  private async sendListMessage(
    account: any,
    to: string,
    text: string,
    buttonText: string,
    sections: Array<{
      title?: string;
      rows: Array<{ id: string; title: string; description?: string }>;
    }>,
    conversationId: string,
    organizationId: string
  ): Promise<boolean> {
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

      if (!validSections.length) return false;

      await whatsappService.sendMessage({
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
    } catch (error) {
      console.error(`❌ List send failed:`, error);
      return false;
    }
  }

  // ==========================================
  // EDGE FINDERS
  // ==========================================
  private findButtonEdge(
    nodeId: string,
    button: { id: string; text: string },
    rawInput: string,
    flowData: FlowData
  ): FlowEdge | null {
    const edges = flowData.edges.filter(e => e.source === nodeId);

    // Priority order
    return (
      edges.find(e => e.sourceHandle === rawInput) ||          // Raw input ID
      edges.find(e => e.sourceHandle === button.id) ||         // Button ID
      edges.find(e => e.sourceHandle === button.text) ||       // Button text
      edges.find(e => e.label === button.text) ||              // Edge label
      edges.find(e => e.label === button.id) ||                // Edge label = id
      edges.find(e =>                                           // Case insensitive
        e.label?.toLowerCase() === button.text.toLowerCase()
      ) ||
      null
    );
  }

  private findListEdge(
    nodeId: string,
    row: { id: string; title: string },
    rawInput: string,
    flowData: FlowData
  ): FlowEdge | null {
    const edges = flowData.edges.filter(e => e.source === nodeId);

    return (
      edges.find(e => e.sourceHandle === rawInput) ||
      edges.find(e => e.sourceHandle === row.id) ||
      edges.find(e => e.sourceHandle === row.title) ||
      edges.find(e => e.label === row.title) ||
      edges.find(e => e.label === row.id) ||
      edges.find(e =>
        e.label?.toLowerCase() === row.title.toLowerCase()
      ) ||
      null
    );
  }

  private getNextNodeId(nodeId: string, flowData: FlowData): string | null {
    // Prefer edge without sourceHandle (main flow)
    const defaultEdge = flowData.edges.find(
      e => e.source === nodeId && !e.sourceHandle
    );
    if (defaultEdge) return defaultEdge.target;

    // Any edge
    const anyEdge = flowData.edges.find(e => e.source === nodeId);
    return anyEdge?.target || null;
  }

  // ==========================================
  // EXECUTE ACTION
  // ==========================================
  private async executeAction(
    action: { type: string; params: Record<string, any> } | undefined,
    session: ChatSession,
    organizationId: string,
    phone: string,
    conversationId: string
  ): Promise<void> {
    if (!action) return;
    console.log(`⚡ Action: ${action.type}`);

    try {
      switch (action.type) {

        case 'tagContact': {
          const tag = action.params?.tag;
          if (!tag) break;
          const phone10 = phone.replace(/\D/g, '').slice(-10);
          await prisma.contact.updateMany({
            where: {
              organizationId,
              OR: [
                { phone: phone10 },
                { phone: `+91${phone10}` },
                { phone: `91${phone10}` },
                { phone },
              ],
            },
            data: { tags: { push: tag } },
          });
          console.log(`🏷️ Tagged: ${tag}`);
          break;
        }

        case 'setVariable': {
          const { name, value } = action.params || {};
          if (name) {
            session.variables[name] = value;
            console.log(`📝 Variable: ${name} = ${value}`);
          }
          break;
        }

        case 'createLead': {
          const phone10 = phone.replace(/\D/g, '').slice(-10);
          const contact = await prisma.contact.findFirst({
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
          if (contact) {
            const existing = await prisma.lead.findFirst({
              where: {
                organizationId,
                contactId: contact.id,
                status: { notIn: ['WON', 'LOST'] },
              },
            });
            if (!existing) {
              await prisma.lead.create({
                data: {
                  organizationId,
                  contactId: contact.id,
                  title: action.params?.title || 'Chatbot Lead',
                  source: 'chatbot',
                  status: 'NEW',
                },
              });
              console.log(`💼 Lead created`);
            }
          }
          break;
        }

        case 'webhook': {
          const { url, method = 'POST' } = action.params || {};
          if (!url) break;
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 5000);
          try {
            await fetch(url, {
              method,
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                phone, organizationId, conversationId,
                variables: session.variables,
                timestamp: new Date().toISOString(),
              }),
              signal: controller.signal,
            });
          } finally {
            clearTimeout(timeout);
          }
          break;
        }
      }
    } catch (error) {
      console.error(`❌ Action "${action.type}" error:`, error);
    }
  }

  // ==========================================
  // EVALUATE CONDITION
  // ==========================================
  private evaluateCondition(
    condition: {
      variable: string;
      operator: string;
      value: string;
    } | undefined,
    variables: Record<string, any>
  ): boolean {
    if (!condition) return true;

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
  private replaceVariables(
    text: string,
    variables: Record<string, any>
  ): string {
    return text.replace(/\{\{(\w+)\}\}/g, (_, key) => {
      return variables[key] !== undefined
        ? String(variables[key])
        : `{{${key}}}`;
    });
  }

  // ==========================================
  // SLEEP
  // ==========================================
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // ==========================================
  // PUBLIC METHODS
  // ==========================================

  // Human takeover - session clear karo
  async clearSession(
    organizationId: string,
    conversationId: string
  ): Promise<void> {
    const key = `${organizationId}:${conversationId}`;
    await sessionManager.delete(key);
    console.log(`🤖 Session cleared: ${key}`);
  }

  // Session info
  async getSessionInfo(
    organizationId: string,
    conversationId: string
  ) {
    const key = `${organizationId}:${conversationId}`;
    const session = await sessionManager.get(key);
    if (!session) return null;
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

export const chatbotEngine = new ChatbotEngine();
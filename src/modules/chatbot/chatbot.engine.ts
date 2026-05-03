// src/modules/chatbot/chatbot.engine.ts
// COMPLETE REPLACE

import prisma from '../../config/database';
import { whatsappService } from '../whatsapp/whatsapp.service';
import { aiService } from './ai.service';

// ============================================
// TYPES
// ============================================

interface FlowNode {
  id: string;
  type: 'start' | 'message' | 'button' | 'list' | 'condition' | 'delay' | 'action' | 'ai' | 'end';
  data: {
    label?: string;
    message?: string;
    buttons?: Array<{ id: string; text: string }>;
    listButtonText?: string;
    listSections?: Array<{
      title?: string;
      rows: Array<{ id: string; title: string; description?: string }>;
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

interface ChatSession {
  chatbotId: string;
  organizationId: string;
  currentNodeId: string;
  variables: Record<string, any>;
  chatHistory?: any[];
  waitingForInput: boolean;
  // Button node ke liye - kaunse buttons expect kar rahe hain
  expectedButtons?: Array<{ id: string; text: string; nextNodeId?: string }>;
  startedAt: Date;
  lastActivityAt: Date;
  messageCount: number;
}

// ============================================
// SESSION STORE - Thread Safe
// ============================================

class SessionStore {
  private sessions = new Map<string, ChatSession>();
  private locks = new Set<string>();

  get(key: string): ChatSession | undefined {
    return this.sessions.get(key);
  }

  set(key: string, session: ChatSession): void {
    session.lastActivityAt = new Date();
    this.sessions.set(key, session);
  }

  delete(key: string): void {
    this.sessions.delete(key);
    this.locks.delete(key);
  }

  isLocked(key: string): boolean {
    return this.locks.has(key);
  }

  lock(key: string): void {
    this.locks.add(key);
  }

  unlock(key: string): void {
    this.locks.delete(key);
  }

  // Expired sessions cleanup (30 min default)
  cleanup(maxAgeMs = 30 * 60 * 1000): void {
    const now = Date.now();
    for (const [key, session] of this.sessions.entries()) {
      if (now - session.lastActivityAt.getTime() > maxAgeMs) {
        this.sessions.delete(key);
        this.locks.delete(key);
        console.log(`🗑️ Session expired: ${key}`);
      }
    }
  }

  size(): number {
    return this.sessions.size;
  }
}

const sessionStore = new SessionStore();

// Cleanup every 10 minutes
setInterval(() => {
  sessionStore.cleanup();
}, 10 * 60 * 1000);

// ============================================
// CHATBOT ENGINE - BULLETPROOF
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

    // ✅ Concurrent message protection
    if (sessionStore.isLocked(sessionKey)) {
      console.log(`🔒 Session locked, skipping: ${sessionKey}`);
      return;
    }

    sessionStore.lock(sessionKey);

    try {
      const cleanMessage = (messageContent || '').trim();
      console.log(`\n🤖 ===== CHATBOT ENGINE =====`);
      console.log(`   Msg: "${cleanMessage}"`);
      console.log(`   Phone: ${senderPhone}`);
      console.log(`   New: ${isNewConversation}`);
      console.log(`   Sessions active: ${sessionStore.size()}`);

      // 1. Existing session check
      const existingSession = sessionStore.get(sessionKey);

      // 2. Find chatbot
      let chatbot = await this.findMatchingChatbot(
        organizationId,
        cleanMessage,
        isNewConversation,
        existingSession?.chatbotId
      );

      // If no chatbot found but stale session exists → clear session and retry as new
      if (!chatbot && existingSession) {
        console.log(`⚠️ No chatbot found for existing session. Clearing stale session and retrying...`);
        sessionStore.delete(sessionKey);
        chatbot = await this.findMatchingChatbot(
          organizationId,
          cleanMessage,
          true, // treat as new to allow default bot
          undefined
        );
      }

      if (!chatbot) {
        console.log(`🤖 No chatbot found for this message`);
        return;
      }

      const flowData = chatbot.flowData as unknown as FlowData;

      if (!flowData?.nodes?.length) {
        console.log(`🤖 Chatbot "${chatbot.name}" has no flow`);
        return;
      }

      // 3. WhatsApp account
      const account = await prisma.whatsAppAccount.findFirst({
        where: { organizationId, status: 'CONNECTED' },
        orderBy: { isDefault: 'desc' },
      });

      if (!account) {
        console.error(`🤖 No WhatsApp account connected`);
        return;
      }

      // 4. Session handling
      let session = existingSession;

      if (!session || isNewConversation) {
        // ── NEW SESSION ──────────────────────────
        console.log(`🆕 Creating new session for chatbot: ${chatbot.name}`);

        // Send welcome message if set
        if (chatbot.welcomeMessage && isNewConversation) {
          await this.sendText(
            account, senderPhone,
            chatbot.welcomeMessage,
            conversationId, organizationId
          );
          await this.sleep(500);
        }

        const startNode = flowData.nodes.find(n => n.type === 'start');
        if (!startNode) {
          console.error(`🤖 No start node in flow`);
          return;
        }

        const firstNodeId = this.getNextNodeId(startNode.id, flowData);
        if (!firstNodeId) {
          console.error(`🤖 Start node not connected`);
          return;
        }

        session = {
          chatbotId: chatbot.id,
          organizationId,
          currentNodeId: firstNodeId,
          variables: {
            phone: senderPhone,
            conversationId,
            message: cleanMessage,
          },
          waitingForInput: false,
          startedAt: new Date(),
          lastActivityAt: new Date(),
          messageCount: 0,
        };

      } else {
        // ── EXISTING SESSION ─────────────────────
        console.log(`🔄 Resuming session at node: ${session.currentNodeId}`);
        session.variables['lastInput'] = cleanMessage;
        session.variables['message'] = cleanMessage;
        session.messageCount++;

        if (session.waitingForInput) {
          // User ne input diya - process karo
          session = await this.handleUserInput(
            session, cleanMessage, flowData
          );
        } else {
          // ── EXISTING SESSION, NOT WAITING ────────
          // Session hai but current node user input expect nahi kar raha
          // ye tab hota hai jab user flow ke beech mein random message bheje
          console.log(`⚠️ Session active but not waiting for input at node: ${session.currentNodeId}`);

          // Keyword match check - kya naya chatbot trigger hoga?
          const newChatbot = await this.findMatchingChatbot(
            organizationId, cleanMessage, false, undefined
          );

          if (newChatbot && newChatbot.id !== session.chatbotId) {
            // Different chatbot keyword match - reset session
            console.log(`🔀 Different chatbot triggered, resetting session`);
            sessionStore.delete(sessionKey);
            await this.processMessage(
              conversationId, organizationId,
              cleanMessage, senderPhone, true
            );
            return;
          }

          // Current node check - agar ye message node waitForInput=true pe ruka hua hai
          const currentNode = flowData.nodes.find(n => n.id === session!.currentNodeId);
          if (currentNode?.type === 'message' && currentNode.data.waitForInput) {
            // Resume flow from next node
            console.log(`▶️ Resuming flow after waitForInput message node`);
            const nextId = this.getNextNodeId(currentNode.id, flowData);
            if (nextId) {
              session.currentNodeId = nextId;
              session.variables['lastInput'] = cleanMessage;
              session.variables['message'] = cleanMessage;
              session.waitingForInput = false;
            }
          } else {
            // Fallback: user kuch bhi bola but flow ne expect nahi kiya
            if (chatbot.fallbackMessage) {
              await this.sendText(
                account, senderPhone,
                chatbot.fallbackMessage,
                conversationId, organizationId
              );
            }
            // Flow ko current position pe hi rakhenge — user ko button ya list se respond karna chahiye
          }
        }
      }

      // 5. Save session
      sessionStore.set(sessionKey, session);

      // 6. Execute flow
      if (!session.waitingForInput) {
        await this.executeFlow(
          session, flowData, account,
          conversationId, organizationId,
          senderPhone, sessionKey,
          chatbot.fallbackMessage || ''
        );
      }

    } catch (error) {
      console.error(`🤖 Engine error:`, error);
    } finally {
      sessionStore.unlock(sessionKey);
      console.log(`🤖 ===== ENGINE END =====\n`);
    }
  }

  // ==========================================
  // HANDLE USER INPUT
  // Button reply ya free text process karo
  // ==========================================
  private async handleUserInput(
    session: ChatSession,
    input: string,
    flowData: FlowData
  ): Promise<ChatSession> {
    const currentNode = flowData.nodes.find(n => n.id === session.currentNodeId);

    if (!currentNode) {
      session.waitingForInput = false;
      return session;
    }

    console.log(`🎯 Handling input for node type: ${currentNode.type}`);

    if (currentNode.type === 'button') {
      // ── BUTTON NODE ──────────────────────────
      const buttons = currentNode.data.buttons || [];

      // Match strategies (order matters):
      // 1. Exact text match (case insensitive)
      // 2. Partial text match
      // 3. Button ID match
      // 4. Number match (user ne "1" ya "2" daba diya)
      // 5. Any edge (fallback)

      let matchedButton: { id: string; text: string } | null = null;
      const inputLower = input.toLowerCase().trim();

      // Strategy 1: Exact match
      matchedButton = buttons.find(
        b => b.text.toLowerCase().trim() === inputLower
      ) || null;

      // Strategy 2: Partial match
      if (!matchedButton) {
        matchedButton = buttons.find(
          b => inputLower.includes(b.text.toLowerCase().trim()) ||
            b.text.toLowerCase().trim().includes(inputLower)
        ) || null;
      }

      // Strategy 3: ID match
      if (!matchedButton) {
        matchedButton = buttons.find(b => b.id === input) || null;
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

        // Find edge with this button's sourceHandle
        const buttonEdge = flowData.edges.find(
          e => e.source === currentNode.id &&
            (e.sourceHandle === matchedButton!.id ||
              e.sourceHandle === matchedButton!.text ||
              e.label === matchedButton!.text)
        );

        if (buttonEdge) {
          session.currentNodeId = buttonEdge.target;
          console.log(`➡️ Moving to: ${buttonEdge.target}`);
        } else {
          // Fallback: first edge from this node
          const anyEdge = flowData.edges.find(e => e.source === currentNode.id);
          if (anyEdge) {
            session.currentNodeId = anyEdge.target;
            console.log(`➡️ Fallback edge to: ${anyEdge.target}`);
          }
        }
      } else {
        console.log(`❌ No button matched for: "${input}"`);
        // Stay on same node - will send fallback
      }

      session.waitingForInput = false;

    } else if (currentNode.type === 'list') {
      // ── LIST NODE ──────────────────────────
      const sections = currentNode.data.listSections || [];
      let allRows: Array<{ id: string; title: string; description?: string }> = [];
      sections.forEach(s => {
        if (s.rows) allRows = allRows.concat(s.rows);
      });

      let matchedRow: { id: string; title: string } | null = null;
      const inputLower = input.toLowerCase().trim();

      // Strategy 1: Exact match
      matchedRow = allRows.find(
        r => r.title.toLowerCase().trim() === inputLower
      ) || null;

      // Strategy 2: Partial match
      if (!matchedRow) {
        matchedRow = allRows.find(
          r => inputLower.includes(r.title.toLowerCase().trim()) ||
            r.title.toLowerCase().trim().includes(inputLower)
        ) || null;
      }

      // Strategy 3: ID match
      if (!matchedRow) {
        matchedRow = allRows.find(r => r.id === input) || null;
      }

      // Strategy 4: Number match
      if (!matchedRow) {
        const num = parseInt(input);
        if (!isNaN(num) && num >= 1 && num <= allRows.length) {
          matchedRow = allRows[num - 1];
        }
      }

      if (matchedRow) {
        console.log(`✅ List option matched: "${matchedRow.title}"`);

        const listEdge = flowData.edges.find(
          e => e.source === currentNode.id &&
            (e.sourceHandle === matchedRow!.id ||
              e.sourceHandle === matchedRow!.title ||
              e.label === matchedRow!.title)
        );

        if (listEdge) {
          session.currentNodeId = listEdge.target;
          console.log(`➡️ Moving to: ${listEdge.target}`);
        } else {
          const anyEdge = flowData.edges.find(e => e.source === currentNode.id);
          if (anyEdge) {
            session.currentNodeId = anyEdge.target;
            console.log(`➡️ Fallback edge to: ${anyEdge.target}`);
          }
        }
      } else {
        console.log(`❌ No list option matched for: "${input}"`);
      }

      session.waitingForInput = false;

    } else if (currentNode.type === 'condition') {
      // ── CONDITION NODE ───────────────────────
      // Input already in variables, just evaluate
      session.waitingForInput = false;

    } else if (currentNode.type === 'message' && currentNode.data.waitForInput) {
      // ── MESSAGE NODE (waitForInput) ──────────
      // User ka input store karo, next node pe move karo
      console.log(`✅ [message waitForInput] User replied: "${input}"`);
      session.variables['lastInput'] = input;
      session.variables['message'] = input;

      // Move to next node
      const nextId = this.getNextNodeId(currentNode.id, flowData);
      if (nextId) {
        session.currentNodeId = nextId;
        console.log(`➡️ Moving to next node: ${nextId}`);
      }
      session.waitingForInput = false;

    } else {
      // ── OTHER NODES ──────────────────────────
      session.waitingForInput = false;
    }

    return session;
  }

  // ==========================================
  // EXECUTE FLOW
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
    // Max depth guard
    if (depth > 25) {
      console.error(`🤖 Max depth (25) reached - infinite loop protection`);
      return;
    }

    const node = flowData.nodes.find(n => n.id === session.currentNodeId);

    if (!node) {
      console.log(`🤖 Node not found: ${session.currentNodeId}`);

      // Send fallback if available
      if (fallbackMessage) {
        await this.sendText(
          account, senderPhone,
          fallbackMessage,
          conversationId, organizationId
        );
      }
      return;
    }

    console.log(`▶️ Node [${node.type}] id:${node.id} depth:${depth}`);

    switch (node.type) {

      // ────────────────────────────────────────
      case 'start': {
        const nextId = this.getNextNodeId(node.id, flowData);
        if (nextId) {
          session.currentNodeId = nextId;
          sessionStore.set(sessionKey, session);
          await this.executeFlow(
            session, flowData, account,
            conversationId, organizationId,
            senderPhone, sessionKey,
            fallbackMessage, depth + 1
          );
        }
        break;
      }

      // ────────────────────────────────────────
      case 'message': {
        const text = node.data.message || '';
        const messageType = node.data.messageType || 'text';
        const mediaUrl = node.data.mediaUrl;
        const finalText = text.trim() ? this.replaceVariables(text, session.variables) : '';

        if (messageType === 'text') {
          if (finalText) {
            await this.sendText(
              account, senderPhone,
              finalText, conversationId, organizationId
            );
          }
        } else if (['image', 'video', 'document', 'audio'].includes(messageType) && mediaUrl) {
          try {
            await whatsappService.sendMediaMessage(
              account.id,
              senderPhone,
              messageType as any,
              mediaUrl,
              finalText || undefined, // caption
              conversationId,
              organizationId,
              undefined,
              undefined
            );
          } catch (error) {
            console.error(`🤖 Media send failed, will use text fallback:`, error);
            if (finalText) {
              await this.sendText(
                account, senderPhone,
                finalText, conversationId, organizationId
              );
            }
          }
        }

        // ✅ waitForInput: true → message bhejo, user ka wait karo
        if (node.data.waitForInput) {
          console.log(`⏸️ [message] waitForInput=true → pausing for user input`);
          session.waitingForInput = true;
          sessionStore.set(sessionKey, session);
          break; // Stop here, resume on next user message
        }

        // Auto-advance to next node
        const nextId = this.getNextNodeId(node.id, flowData);
        if (nextId) {
          session.currentNodeId = nextId;
          sessionStore.set(sessionKey, session);
          await this.sleep(600); // Natural typing delay
          await this.executeFlow(
            session, flowData, account,
            conversationId, organizationId,
            senderPhone, sessionKey,
            fallbackMessage, depth + 1
          );
        } else {
          // No next node - end of flow
          sessionStore.delete(sessionKey);
        }
        break;
      }

      // ────────────────────────────────────────
      case 'button': {
        const text = node.data.message || 'Choose an option:';
        const buttons = node.data.buttons || [];

        if (buttons.length === 0) {
          // No buttons configured - treat as message
          await this.sendText(
            account, senderPhone,
            text, conversationId, organizationId
          );
          const nextId = this.getNextNodeId(node.id, flowData);
          if (nextId) {
            session.currentNodeId = nextId;
            sessionStore.set(sessionKey, session);
            await this.executeFlow(
              session, flowData, account,
              conversationId, organizationId,
              senderPhone, sessionKey,
              fallbackMessage, depth + 1
            );
          }
          break;
        }

        const finalText = this.replaceVariables(text, session.variables);

        // ✅ Try interactive buttons first, fallback to numbered list
        const sent = await this.sendButtonMessage(
          account, senderPhone,
          finalText, buttons,
          conversationId, organizationId
        );

        if (!sent) {
          // Fallback: numbered text list
          const numberedText = `${finalText}\n\n${buttons.map((b, i) => `${i + 1}. ${b.text}`).join('\n')
            }`;
          await this.sendText(
            account, senderPhone,
            numberedText, conversationId, organizationId
          );
        }

        // Wait for user response
        session.waitingForInput = true;
        session.expectedButtons = buttons;
        sessionStore.set(sessionKey, session);
        break;
      }

      // ────────────────────────────────────────
      case 'list': {
        const text = node.data.message || 'Please select an option:';
        const finalText = this.replaceVariables(text, session.variables);
        const listButtonText = node.data.listButtonText || 'Options';
        const sections = node.data.listSections || [];

        if (sections.length === 0) {
          // No options configured - treat as message
          await this.sendText(
            account, senderPhone,
            text, conversationId, organizationId
          );
          const nextId = this.getNextNodeId(node.id, flowData);
          if (nextId) {
            session.currentNodeId = nextId;
            sessionStore.set(sessionKey, session);
            await this.executeFlow(
              session, flowData, account,
              conversationId, organizationId,
              senderPhone, sessionKey,
              fallbackMessage, depth + 1
            );
          }
          break;
        }

        const sent = await this.sendListMessage(
          account, senderPhone,
          finalText, listButtonText, sections,
          conversationId, organizationId
        );

        if (!sent) {
          // Fallback: numbered text list
          let flatOptions: Array<{ title: string }> = [];
          sections.forEach(s => {
            if (s.rows) flatOptions = flatOptions.concat(s.rows);
          });
          const numberedText = `${finalText}\n\n${flatOptions.map((b, i) => `${i + 1}. ${b.title}`).join('\n')
            }`;
          await this.sendText(
            account, senderPhone,
            numberedText, conversationId, organizationId
          );
        }

        // Wait for user response
        session.waitingForInput = true;
        session.expectedButtons = []; // We can store list expectations too if needed
        sections.forEach(s => {
          if (s.rows) {
            s.rows.forEach(r => {
              session.expectedButtons!.push({ id: r.id, text: r.title });
            });
          }
        });
        sessionStore.set(sessionKey, session);
        break;
      }

      // ────────────────────────────────────────
      case 'condition': {
        const condition = node.data.condition;
        const result = this.evaluateCondition(condition, session.variables);
        console.log(`🔀 Condition result: ${result}`);

        // Find matching edge
        const handleId = result ? 'true' : 'false';
        let edge = flowData.edges.find(
          e => e.source === node.id && e.sourceHandle === handleId
        );

        // Fallback: any edge
        if (!edge) {
          edge = flowData.edges.find(e => e.source === node.id);
        }

        if (edge) {
          session.currentNodeId = edge.target;
          sessionStore.set(sessionKey, session);
          await this.executeFlow(
            session, flowData, account,
            conversationId, organizationId,
            senderPhone, sessionKey,
            fallbackMessage, depth + 1
          );
        }
        break;
      }

      // ────────────────────────────────────────
      case 'delay': {
        const delayMs = Math.min(
          node.data.delay || 1000,
          10000 // Max 10 seconds
        );
        console.log(`⏱️ Delay: ${delayMs}ms`);
        await this.sleep(delayMs);

        const nextId = this.getNextNodeId(node.id, flowData);
        if (nextId) {
          session.currentNodeId = nextId;
          sessionStore.set(sessionKey, session);
          await this.executeFlow(
            session, flowData, account,
            conversationId, organizationId,
            senderPhone, sessionKey,
            fallbackMessage, depth + 1
          );
        }
        break;
      }

      // ────────────────────────────────────────
      case 'action': {
        await this.executeAction(
          node.data.action,
          session,
          organizationId,
          senderPhone,
          conversationId
        );

        const nextId = this.getNextNodeId(node.id, flowData);
        if (nextId) {
          session.currentNodeId = nextId;
          sessionStore.set(sessionKey, session);
          await this.executeFlow(
            session, flowData, account,
            conversationId, organizationId,
            senderPhone, sessionKey,
            fallbackMessage, depth + 1
          );
        }
        break;
      }

      // ────────────────────────────────────────
      case 'ai': {
        const systemPrompt = node.data.systemPrompt || 'You are a helpful assistant.';
        const userMessage = session.variables.message || '';

        // Ensure chat history exists
        if (!session.chatHistory) {
          session.chatHistory = [];
        }

        // Get AI response
        const aiResponse = await aiService.generateResponse(
          systemPrompt,
          userMessage,
          session.chatHistory
        );

        // Save to history
        session.chatHistory.push({ role: 'user', content: userMessage });
        session.chatHistory.push({ role: 'model', content: aiResponse });

        // Keep history manageable (last 10 messages = 5 interactions)
        if (session.chatHistory.length > 10) {
          session.chatHistory = session.chatHistory.slice(-10);
        }

        // Send response to user
        await this.sendText(
          account, senderPhone,
          aiResponse, conversationId, organizationId
        );

        const nextId = this.getNextNodeId(node.id, flowData);
        if (nextId) {
          session.currentNodeId = nextId;
          sessionStore.set(sessionKey, session);
          await this.executeFlow(
            session, flowData, account,
            conversationId, organizationId,
            senderPhone, sessionKey,
            fallbackMessage, depth + 1
          );
        } else {
          // If no next node, AI acts as a chat interface, wait for more input on this same node
          session.waitingForInput = true;
          sessionStore.set(sessionKey, session);
        }
        break;
      }

      // ────────────────────────────────────────
      case 'end': {
        console.log(`🏁 Flow ended`);
        sessionStore.delete(sessionKey);
        break;
      }

      default:
        console.log(`❓ Unknown node: ${node.type}`);
    }
  }

  // ==========================================
  // FIND MATCHING CHATBOT
  // ==========================================
  private async findMatchingChatbot(
    organizationId: string,
    messageContent: string,
    isNewConversation: boolean,
    existingChatbotId?: string
  ) {
    // Use existing chatbot if session active
    if (existingChatbotId) {
      const bot = await prisma.chatbot.findFirst({
        where: { id: existingChatbotId, organizationId, status: 'ACTIVE' },
      });
      if (bot) {
        console.log(`🔄 Using existing chatbot: ${bot.name}`);
        return bot;
      }
    }

    const allActive = await prisma.chatbot.findMany({
      where: { organizationId, status: 'ACTIVE' },
    });

    if (!allActive.length) return null;

    const lowerMsg = messageContent.toLowerCase().trim();

    // 1. Keyword match - exact first
    for (const bot of allActive) {
      const keywords = (bot.triggerKeywords as string[]) || [];
      const exactMatch = keywords.find(
        kw => kw.toLowerCase().trim() === lowerMsg
      );
      if (exactMatch) {
        console.log(`🎯 Exact keyword match: "${exactMatch}" → ${bot.name}`);
        return bot;
      }
    }

    // 2. Keyword match - partial
    for (const bot of allActive) {
      const keywords = (bot.triggerKeywords as string[]) || [];
      const partialMatch = keywords.find(
        kw => lowerMsg.includes(kw.toLowerCase().trim()) ||
          kw.toLowerCase().trim().includes(lowerMsg)
      );
      if (partialMatch) {
        console.log(`🎯 Partial keyword match: "${partialMatch}" → ${bot.name}`);
        return bot;
      }
    }

    // 3. New conversation → default bot
    if (isNewConversation) {
      const defaultBot = allActive.find(b => b.isDefault);
      if (defaultBot) {
        console.log(`🏠 Default bot for new conversation: ${defaultBot.name}`);
        return defaultBot;
      }
      // First active bot as fallback
      if (allActive.length === 1) return allActive[0];
    }

    return null;
  }

  // ==========================================
  // SEND TEXT - skipWindowCheck = true (BOT)
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
        account.id,
        to,
        text,
        conversationId,
        organizationId,
        undefined, // tempId
        undefined, // clientMsgId
        true // ✅ skipWindowCheck - bot messages bypass 24h check
      );
      console.log(`📤 Bot sent: "${text.substring(0, 50)}"`);
    } catch (error) {
      console.error(`🤖 sendText error:`, error);
    }
  }

  // ==========================================
  // SEND BUTTON MESSAGE
  // Returns true if sent, false if failed
  // ==========================================
  private async sendButtonMessage(
    account: any,
    to: string,
    text: string,
    buttons: Array<{ id: string; text: string }>,
    conversationId: string,
    organizationId: string
  ): Promise<boolean> {
    try {
      // WhatsApp button text max 20 chars
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
        skipWindowCheck: true, // ✅ Bot messages bypass 24h check
      });

      console.log(`📤 Bot sent ${validButtons.length} buttons`);
      return true;
    } catch (error) {
      console.error(`🤖 Button send failed, will use text fallback:`, error);
      return false;
    }
  }

  // ==========================================
  // SEND LIST MESSAGE
  // Returns true if sent, false if failed
  // ==========================================
  private async sendListMessage(
    account: any,
    to: string,
    text: string,
    buttonText: string,
    sections: Array<{ title?: string; rows: Array<{ id: string; title: string; description?: string }> }>,
    conversationId: string,
    organizationId: string
  ): Promise<boolean> {
    try {
      const validSections = sections.filter(s => s.rows && s.rows.length > 0).map(s => ({
        title: s.title ? s.title.substring(0, 24) : undefined,
        rows: s.rows.slice(0, 10).map(r => ({
          id: r.id || `row_${Date.now()}_${Math.random()}`,
          title: r.title.substring(0, 24),
          description: r.description ? r.description.substring(0, 72) : undefined
        }))
      })).slice(0, 10);

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
              sections: validSections
            },
          },
        },
        conversationId,
        organizationId,
        skipWindowCheck: true,
      });

      console.log(`📤 Bot sent list with ${validSections.reduce((acc, s) => acc + s.rows.length, 0)} options`);
      return true;
    } catch (error) {
      console.error(`🤖 List send failed, will use text fallback:`, error);
      return false;
    }
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

          // Multiple phone format support
          const phone10 = phone.replace(/\D/g, '').slice(-10);
          await prisma.contact.updateMany({
            where: {
              organizationId,
              OR: [
                { phone: phone10 },
                { phone: `+91${phone10}` },
                { phone: `91${phone10}` },
                { phone },
                { phone: `+${phone}` },
              ],
            },
            data: { tags: { push: tag } },
          });
          console.log(`🏷️ Tagged contact: ${tag}`);
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
            // Check existing open lead
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
                phone,
                organizationId,
                conversationId,
                variables: session.variables,
                timestamp: new Date().toISOString(),
              }),
              signal: controller.signal,
            });
            console.log(`🌐 Webhook: ${url}`);
          } finally {
            clearTimeout(timeout);
          }
          break;
        }

        default:
          console.log(`❓ Unknown action: ${action.type}`);
      }
    } catch (error) {
      console.error(`⚡ Action "${action.type}" error:`, error);
    }
  }

  // ==========================================
  // EVALUATE CONDITION
  // ==========================================
  private evaluateCondition(
    condition: { variable: string; operator: string; value: string } | undefined,
    variables: Record<string, any>
  ): boolean {
    if (!condition) return true;

    const { variable, operator, value } = condition;
    const varValue = String(variables[variable] ?? '').toLowerCase().trim();
    const compareValue = String(value ?? '').toLowerCase().trim();

    switch (operator) {
      case 'equals':
      case '=':
        return varValue === compareValue;

      case 'not_equals':
      case '!=':
        return varValue !== compareValue;

      case 'contains':
        return varValue.includes(compareValue);

      case 'not_contains':
        return !varValue.includes(compareValue);

      case 'starts_with':
      case 'startsWith':
        return varValue.startsWith(compareValue);

      case 'ends_with':
      case 'endsWith':
        return varValue.endsWith(compareValue);

      case 'greater_than':
      case 'greaterThan':
        return Number(varValue) > Number(compareValue);

      case 'less_than':
      case 'lessThan':
        return Number(varValue) < Number(compareValue);

      case 'is_empty':
        return !varValue || varValue === '';

      case 'is_not_empty':
      case 'exists':
        return !!(varValue && varValue !== '');

      default:
        console.warn(`❓ Unknown operator: ${operator}`);
        return false;
    }
  }

  // ==========================================
  // HELPERS
  // ==========================================

  private getNextNodeId(nodeId: string, flowData: FlowData): string | null {
    // Find edge without sourceHandle (default/main edge)
    const defaultEdge = flowData.edges.find(
      e => e.source === nodeId && !e.sourceHandle
    );
    if (defaultEdge) return defaultEdge.target;

    // Any edge from this node
    const anyEdge = flowData.edges.find(e => e.source === nodeId);
    return anyEdge?.target || null;
  }

  private replaceVariables(text: string, variables: Record<string, any>): string {
    return text.replace(/\{\{(\w+)\}\}/g, (_, key) => {
      return variables[key] !== undefined
        ? String(variables[key])
        : `{{${key}}}`;
    });
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // ✅ Public: Human takeover ke liye session clear karo
  clearSession(organizationId: string, conversationId: string): void {
    const key = `${organizationId}:${conversationId}`;
    sessionStore.delete(key);
    console.log(`🤖 Session cleared: ${key}`);
  }

  // ✅ Public: Session info check karo
  getSessionInfo(organizationId: string, conversationId: string) {
    const key = `${organizationId}:${conversationId}`;
    const session = sessionStore.get(key);
    if (!session) return null;
    return {
      chatbotId: session.chatbotId,
      currentNodeId: session.currentNodeId,
      waitingForInput: session.waitingForInput,
      messageCount: session.messageCount,
      startedAt: session.startedAt,
      lastActivityAt: session.lastActivityAt,
    };
  }
}

export const chatbotEngine = new ChatbotEngine();
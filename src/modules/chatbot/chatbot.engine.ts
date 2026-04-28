// src/modules/chatbot/chatbot.engine.ts

import prisma from '../../config/database';
import { whatsappService } from '../whatsapp/whatsapp.service';

// ============================================
// TYPES
// ============================================

interface FlowNode {
  id: string;
  type: 'start' | 'message' | 'button' | 'condition' | 'delay' | 'action' | 'end';
  data: {
    label?: string;
    message?: string;
    buttons?: Array<{ id: string; text: string }>;
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
    nextNodeId?: string;
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
  currentNodeId: string;
  variables: Record<string, any>;
  waitingForInput: boolean;
  startedAt: Date;
  lastActivityAt: Date;
}

// ============================================
// SESSION STORE
// In-memory → Redis se replace karo production mein
// ============================================

class SessionStore {
  private sessions = new Map<string, ChatSession>();

  get(key: string): ChatSession | undefined {
    return this.sessions.get(key);
  }

  set(key: string, session: ChatSession): void {
    this.sessions.set(key, session);
  }

  delete(key: string): void {
    this.sessions.delete(key);
  }

  // Expired sessions cleanup
  cleanup(maxAgeMs = 30 * 60 * 1000): void {
    const now = Date.now();
    for (const [key, session] of this.sessions.entries()) {
      if (now - session.lastActivityAt.getTime() > maxAgeMs) {
        this.sessions.delete(key);
        console.log(`🗑️ Session expired: ${key}`);
      }
    }
  }
}

const sessionStore = new SessionStore();

// Cleanup every 10 minutes
setInterval(() => sessionStore.cleanup(), 10 * 60 * 1000);

// ============================================
// CHATBOT ENGINE
// ============================================

export class ChatbotEngine {

  // ==========================================
  // MAIN ENTRY: Process incoming message
  // ==========================================
  async processMessage(
    conversationId: string,
    organizationId: string,
    messageContent: string,
    senderPhone: string,
    isNewConversation: boolean
  ): Promise<void> {
    try {
      console.log(`🤖 Processing: "${messageContent}" | conv: ${conversationId} | new: ${isNewConversation}`);

      // 1. Check existing session
      const sessionKey = `${organizationId}:${conversationId}`;
      const existingSession = sessionStore.get(sessionKey);

      // 2. Find matching chatbot
      const chatbot = await this.findMatchingChatbot(
        organizationId,
        messageContent,
        isNewConversation,
        existingSession?.chatbotId
      );

      if (!chatbot) {
        console.log('🤖 No chatbot matched for this message');
        return;
      }

      const flowData = chatbot.flowData as unknown as FlowData;

      if (!flowData?.nodes?.length) {
        console.log('🤖 Chatbot has no flow nodes');
        return;
      }

      // 3. Get WhatsApp account
      const account = await prisma.whatsAppAccount.findFirst({
        where: { organizationId, status: 'CONNECTED' },
        orderBy: { isDefault: 'desc' },
      });

      if (!account) {
        console.error('🤖 No connected WhatsApp account');
        return;
      }

      // 4. Handle session
      let session = existingSession;

      if (!session || isNewConversation) {
        // New session → find start node
        const startNode = flowData.nodes.find(n => n.type === 'start');
        if (!startNode) {
          console.error('🤖 No start node found in flow');
          return;
        }

        // First actual node after start
        const firstNodeId = this.getNextNodeId(startNode.id, flowData);
        if (!firstNodeId) {
          console.error('🤖 Start node has no connected node');
          return;
        }

        session = {
          chatbotId: chatbot.id,
          currentNodeId: firstNodeId,
          variables: {
            phone: senderPhone,
            conversationId,
          },
          waitingForInput: false,
          startedAt: new Date(),
          lastActivityAt: new Date(),
        };

        console.log(`🤖 New session started → node: ${firstNodeId}`);
      } else {
        // Existing session → handle user input
        session.lastActivityAt = new Date();
        session.variables['lastInput'] = messageContent;
        session.variables['lastInputAt'] = new Date().toISOString();

        // If waiting for input (button/question node)
        if (session.waitingForInput) {
          session.waitingForInput = false;

          // Check button reply
          const currentNode = flowData.nodes.find(n => n.id === session!.currentNodeId);

          if (currentNode?.type === 'button') {
            // WhatsApp button_reply → match by title or id
            const matchedButton = currentNode.data.buttons?.find(
              b =>
                b.text.toLowerCase() === messageContent.toLowerCase() ||
                b.id === messageContent ||
                messageContent.toLowerCase().includes(b.text.toLowerCase())
            );

            if (matchedButton) {
              // Find edge with sourceHandle = button id
              const buttonEdge = flowData.edges.find(
                e => e.source === currentNode.id &&
                  (e.sourceHandle === matchedButton.id ||
                    e.sourceHandle === matchedButton.text)
              );

              if (buttonEdge) {
                session.currentNodeId = buttonEdge.target;
                console.log(`🤖 Button "${matchedButton.text}" → node: ${buttonEdge.target}`);
              } else {
                // Fallback: any edge from this button node
                const anyEdge = flowData.edges.find(e => e.source === currentNode.id);
                if (anyEdge) {
                  session.currentNodeId = anyEdge.target;
                }
              }
            }
          }
        }
      }

      // 5. Save session
      sessionStore.set(sessionKey, session);

      // 6. Execute flow from current node
      await this.executeFlow(
        session,
        flowData,
        account,
        conversationId,
        organizationId,
        senderPhone,
        sessionKey
      );

    } catch (error) {
      console.error('🤖 ChatbotEngine.processMessage error:', error);
    }
  }

  // ==========================================
  // EXECUTE FLOW
  // Auto-advances through nodes until user input needed
  // ==========================================
  private async executeFlow(
    session: ChatSession,
    flowData: FlowData,
    account: any,
    conversationId: string,
    organizationId: string,
    senderPhone: string,
    sessionKey: string,
    depth = 0
  ): Promise<void> {
    // Prevent infinite loops
    if (depth > 20) {
      console.error('🤖 Max depth reached - possible infinite loop');
      return;
    }

    const node = flowData.nodes.find(n => n.id === session.currentNodeId);

    if (!node) {
      console.log(`🤖 Node not found: ${session.currentNodeId}`);
      return;
    }

    console.log(`🤖 Executing node [${node.type}] id: ${node.id} depth: ${depth}`);

    switch (node.type) {
      case 'start': {
        // Auto-advance
        const nextId = this.getNextNodeId(node.id, flowData);
        if (nextId) {
          session.currentNodeId = nextId;
          sessionStore.set(sessionKey, session);
          await this.executeFlow(session, flowData, account, conversationId, organizationId, senderPhone, sessionKey, depth + 1);
        }
        break;
      }

      case 'message': {
        const text = this.replaceVariables(node.data.message || '', session.variables);
        await this.sendTextMessage(account, senderPhone, text, conversationId, organizationId);

        // Auto-advance to next node
        const nextId = this.getNextNodeId(node.id, flowData);
        if (nextId) {
          session.currentNodeId = nextId;
          sessionStore.set(sessionKey, session);
          // Small delay between messages
          await this.sleep(500);
          await this.executeFlow(session, flowData, account, conversationId, organizationId, senderPhone, sessionKey, depth + 1);
        }
        break;
      }

      case 'button': {
        const text = this.replaceVariables(node.data.message || 'Choose an option:', session.variables);
        const buttons = node.data.buttons || [];

        await this.sendButtonMessage(account, senderPhone, text, buttons, conversationId, organizationId);

        // Wait for user response
        session.waitingForInput = true;
        sessionStore.set(sessionKey, session);
        break;
      }

      case 'condition': {
        const condition = node.data.condition;
        const result = this.evaluateCondition(condition, session.variables);

        // Find YES or NO edge
        const handleId = result ? 'true' : 'false';
        const edge = flowData.edges.find(
          e => e.source === node.id && e.sourceHandle === handleId
        );

        // Fallback: any edge
        const fallbackEdge = flowData.edges.find(e => e.source === node.id);
        const targetEdge = edge || fallbackEdge;

        if (targetEdge) {
          session.currentNodeId = targetEdge.target;
          sessionStore.set(sessionKey, session);
          await this.executeFlow(session, flowData, account, conversationId, organizationId, senderPhone, sessionKey, depth + 1);
        }
        break;
      }

      case 'delay': {
        const delayMs = Math.min(node.data.delay || 1000, 5000); // Max 5 seconds
        console.log(`🤖 Delay: ${delayMs}ms`);
        await this.sleep(delayMs);

        const nextId = this.getNextNodeId(node.id, flowData);
        if (nextId) {
          session.currentNodeId = nextId;
          sessionStore.set(sessionKey, session);
          await this.executeFlow(session, flowData, account, conversationId, organizationId, senderPhone, sessionKey, depth + 1);
        }
        break;
      }

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
          await this.executeFlow(session, flowData, account, conversationId, organizationId, senderPhone, sessionKey, depth + 1);
        }
        break;
      }

      case 'end': {
        console.log('🤖 Flow completed ✅');
        sessionStore.delete(sessionKey);
        break;
      }

      default:
        console.log(`🤖 Unknown node type: ${node.type}`);
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
    // If session already has a chatbot, use it
    if (existingChatbotId) {
      const chatbot = await prisma.chatbot.findFirst({
        where: { id: existingChatbotId, organizationId, status: 'ACTIVE' },
      });
      if (chatbot) return chatbot;
    }

    const allActive = await prisma.chatbot.findMany({
      where: { organizationId, status: 'ACTIVE' },
    });

    if (!allActive.length) return null;

    const lowerMsg = messageContent.toLowerCase().trim();

    // 1. Check keyword match (exact or contains)
    for (const chatbot of allActive) {
      const keywords = (chatbot.triggerKeywords as string[]) || [];
      for (const kw of keywords) {
        if (lowerMsg === kw.toLowerCase() || lowerMsg.includes(kw.toLowerCase())) {
          console.log(`🤖 Keyword match: "${kw}" → ${chatbot.name}`);
          return chatbot;
        }
      }
    }

    // 2. New conversation → use default chatbot
    if (isNewConversation) {
      const defaultBot = allActive.find(c => c.isDefault);
      if (defaultBot) {
        console.log(`🤖 Default chatbot: ${defaultBot.name}`);
        return defaultBot;
      }
    }

    // 3. Existing session with active flow → check any bot without keywords (catch-all)
    if (!isNewConversation) {
      const catchAll = allActive.find(
        c => c.isDefault && (!c.triggerKeywords || (c.triggerKeywords as string[]).length === 0)
      );
      if (catchAll) return catchAll;
    }

    return null;
  }

  // ==========================================
  // GET NEXT NODE via edges
  // ==========================================
  private getNextNodeId(nodeId: string, flowData: FlowData): string | null {
    const edge = flowData.edges.find(e => e.source === nodeId && !e.sourceHandle);
    if (edge) return edge.target;

    // Try any edge from this node
    const anyEdge = flowData.edges.find(e => e.source === nodeId);
    return anyEdge?.target || null;
  }

  // ==========================================
  // SEND TEXT MESSAGE
  // ==========================================
  private async sendTextMessage(
    account: any,
    to: string,
    text: string,
    conversationId: string,
    organizationId: string
  ): Promise<void> {
    try {
      if (!text.trim()) return;

      await whatsappService.sendTextMessage(
        account.id,
        to,
        text,
        conversationId,
        organizationId
      );

      console.log(`🤖 Sent: "${text.substring(0, 60)}"`);
    } catch (error) {
      console.error('🤖 sendTextMessage error:', error);
    }
  }

  // ==========================================
  // SEND BUTTON MESSAGE
  // ==========================================
  private async sendButtonMessage(
    account: any,
    to: string,
    text: string,
    buttons: Array<{ id: string; text: string }>,
    conversationId: string,
    organizationId: string
  ): Promise<void> {
    try {
      if (!buttons.length) {
        // Fallback: send as text
        await this.sendTextMessage(account, to, text, conversationId, organizationId);
        return;
      }

      await whatsappService.sendMessage({
        accountId: account.id,
        to,
        type: 'interactive',
        content: {
          interactive: {
            type: 'button',
            body: { text },
            action: {
              buttons: buttons.slice(0, 3).map(b => ({
                type: 'reply',
                reply: {
                  id: b.id,
                  title: b.text.substring(0, 20),
                },
              })),
            },
          },
        },
        conversationId,
        organizationId,
      });

      console.log(`🤖 Sent button message with ${buttons.length} buttons`);
    } catch (error) {
      console.error('🤖 sendButtonMessage error:', error);
      // Fallback to text
      try {
        const fallbackText = `${text}\n\n${buttons.map((b, i) => `${i + 1}. ${b.text}`).join('\n')}`;
        await this.sendTextMessage(account, to, fallbackText, conversationId, organizationId);
      } catch (e) {
        console.error('🤖 Fallback text also failed:', e);
      }
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
    const varValue = String(variables[variable] || '').toLowerCase();
    const compareValue = String(value || '').toLowerCase();

    switch (operator) {
      case 'equals':       return varValue === compareValue;
      case 'not_equals':   return varValue !== compareValue;
      case 'contains':     return varValue.includes(compareValue);
      case 'starts_with':  return varValue.startsWith(compareValue);
      case 'ends_with':    return varValue.endsWith(compareValue);
      case 'greater_than': return Number(varValue) > Number(compareValue);
      case 'less_than':    return Number(varValue) < Number(compareValue);
      case 'is_empty':     return !varValue || varValue === '';
      case 'is_not_empty': return !!(varValue && varValue !== '');
      // Legacy operators
      case 'startsWith':   return varValue.startsWith(compareValue);
      case 'endsWith':     return varValue.endsWith(compareValue);
      case 'greaterThan':  return Number(varValue) > Number(compareValue);
      case 'lessThan':     return Number(varValue) < Number(compareValue);
      case 'exists':       return !!(varValue && varValue !== '');
      default:
        console.warn(`🤖 Unknown operator: ${operator}`);
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

    console.log(`🤖 Action: ${action.type}`, action.params);

    try {
      switch (action.type) {
        case 'tagContact': {
          const tag = action.params?.tag;
          if (!tag) break;

          // Find contact by phone (multiple formats)
          const phone10 = phone.replace(/\D/g, '').slice(-10);
          await prisma.contact.updateMany({
            where: {
              organizationId,
              OR: [
                { phone: phone10 },
                { phone: `+91${phone10}` },
                { phone: `91${phone10}` },
                { phone: phone },
              ],
            },
            data: {
              tags: { push: tag },
            },
          });
          console.log(`🤖 Tag added: ${tag}`);
          break;
        }

        case 'setVariable': {
          const { name, value } = action.params || {};
          if (name) {
            session.variables[name] = value;
            console.log(`🤖 Variable set: ${name} = ${value}`);
          }
          break;
        }

        case 'createLead': {
          // Find contact
          const phone10 = phone.replace(/\D/g, '').slice(-10);
          const contact = await prisma.contact.findFirst({
            where: {
              organizationId,
              OR: [
                { phone: phone10 },
                { phone: `+91${phone10}` },
                { phone: `91${phone10}` },
              ],
            },
          });

          if (contact) {
            await (prisma as any).lead?.create({
              data: {
                organizationId,
                contactId: contact.id,
                title: action.params?.title || 'Chatbot Lead',
                source: 'chatbot',
                status: 'NEW',
              },
            }).catch(() => console.log('🤖 Lead table not found, skipping'));
          }
          break;
        }

        case 'webhook': {
          const { url, method = 'POST' } = action.params || {};
          if (!url) break;

          await fetch(url, {
            method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              phone,
              organizationId,
              conversationId,
              variables: session.variables,
            }),
          });
          console.log(`🤖 Webhook called: ${url}`);
          break;
        }

        default:
          console.log(`🤖 Unknown action: ${action.type}`);
      }
    } catch (error) {
      console.error(`🤖 Action "${action.type}" error:`, error);
    }
  }

  // ==========================================
  // HELPERS
  // ==========================================
  private replaceVariables(text: string, variables: Record<string, any>): string {
    return text.replace(/\{\{(\w+)\}\}/g, (_, key) => {
      return variables[key] !== undefined ? String(variables[key]) : `{{${key}}}`;
    });
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // ✅ Public: Clear session (call when human takes over)
  clearSession(organizationId: string, conversationId: string): void {
    const key = `${organizationId}:${conversationId}`;
    sessionStore.delete(key);
    console.log(`🤖 Session cleared: ${key}`);
  }
}

export const chatbotEngine = new ChatbotEngine();
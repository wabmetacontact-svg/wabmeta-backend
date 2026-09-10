// src/modules/telegram/telegram.flow.ts
//
// A lightweight interpreter that runs the SAME visual flow (Chatbot.flowData,
// built in the existing ChatbotBuilder) on Telegram. It is deliberately separate
// from the WhatsApp chatbot engine so it cannot regress that production path.
//
// Supported node types: start, message, button, list, condition, delay, action, ai.
// Sessions live in the shared KV store (getRedis) keyed by conversation id.

import prisma from '../../config/database';
import { getRedis } from '../../config/redis';

// The builder has gone through a few shapes; the runner stays tolerant of all of
// them (text|message, title|text on buttons, both condition/action variants).
interface FlowButton { id: string; text?: string; title?: string; type?: string; value?: string; nextNodeId?: string }
interface FlowNode {
  id: string;
  type: 'start' | 'message' | 'button' | 'list' | 'condition' | 'delay' | 'action' | 'ai' | 'end' | string;
  data: {
    label?: string;
    message?: string;
    text?: string;
    mediaUrl?: string;
    messageType?: string;
    systemPrompt?: string;
    buttons?: FlowButton[];
    listButtonText?: string;
    listSections?: Array<{ title?: string; rows: Array<{ id: string; title: string; description?: string }> }>;
    condition?: { type?: string; value?: string; variable?: string; operator?: string };
    delay?: number;
    action?: { type?: string; value?: string; params?: Record<string, any> };
  };
}

const nodeText = (n: FlowNode): string => (n.data.message || n.data.text || '').trim();
const btnText = (b: FlowButton): string => (b.text || b.title || '').trim();
interface FlowEdge { id: string; source: string; target: string; sourceHandle?: string; label?: string }
interface FlowData { nodes: FlowNode[]; edges: FlowEdge[] }

interface FlowSession {
  chatbotId: string;
  waitNodeId: string;              // the button/input node we are parked on
  waitKind: 'button' | 'input';
  waitButtons?: { id: string; token: string; nextNodeId?: string }[]; // token = callback_data we sent
  variables: Record<string, string>;
  updatedAt: number;
}

const PREFIX = 'tgflow:session:';
const TTL = 24 * 60 * 60;
const MAX_STEPS = 25; // guard against a mis-wired flow looping forever

const sessionKey = (conversationId: string) => `${PREFIX}${conversationId}`;

const getSession = async (conversationId: string): Promise<FlowSession | null> => {
  try {
    const redis = getRedis();
    if (!redis) return null;
    const raw = await redis.get(sessionKey(conversationId));
    return raw ? (JSON.parse(raw) as FlowSession) : null;
  } catch { return null; }
};

const setSession = async (conversationId: string, s: FlowSession) => {
  try {
    const redis = getRedis();
    if (!redis) return;
    s.updatedAt = Date.now();
    await redis.setex(sessionKey(conversationId), TTL, JSON.stringify(s));
  } catch { /* best-effort */ }
};

const clearSession = async (conversationId: string) => {
  try {
    const redis = getRedis();
    if (redis) await redis.del(sessionKey(conversationId));
  } catch { /* best-effort */ }
};

const getNode = (flow: FlowData, id?: string) => flow.nodes.find((n) => n.id === id);

/** First outgoing edge from a node, optionally matching a sourceHandle/label. */
const nextEdge = (flow: FlowData, nodeId: string, handle?: string): FlowEdge | undefined => {
  const edges = flow.edges.filter((e) => e.source === nodeId);
  if (handle) {
    const byHandle = edges.find((e) => e.sourceHandle === handle || e.label?.toLowerCase() === handle.toLowerCase());
    if (byHandle) return byHandle;
  }
  return edges[0];
};

const evalCondition = (cond: FlowNode['data']['condition'], input: string, vars: Record<string, string>): boolean => {
  if (!cond) return false;
  const v = (cond.value || '').toLowerCase().trim();
  // Compare against a named variable if given, else the latest user input.
  const subject = (cond.variable && vars[cond.variable] != null ? String(vars[cond.variable]) : input || '')
    .toLowerCase().trim();
  const op = cond.operator || cond.type; // support {operator} and {type}
  switch (op) {
    case 'equals':
    case 'exact': return subject === v;
    case 'not_equals': return subject !== v;
    case 'starts_with': return subject.startsWith(v);
    case 'ends_with': return subject.endsWith(v);
    case 'is_empty': return subject.length === 0;
    case 'is_not_empty': return subject.length > 0;
    case 'regex':
      try { return new RegExp(cond.value || '', 'i').test(input); } catch { return false; }
    case 'contains':
    case 'keyword':
    default:
      return v.split(',').map((x) => x.trim()).filter(Boolean).some((k) => subject.includes(k));
  }
};

/**
 * Find the Telegram chatbot that should start for this inbound message:
 * a triggerKeyword match wins; otherwise the org's default Telegram bot.
 */
const findMatchingChatbot = async (organizationId: string, botId: string, input: string) => {
  const bots = await prisma.chatbot.findMany({
    where: { organizationId, channel: 'TELEGRAM', status: 'ACTIVE' },
    orderBy: { isDefault: 'desc' },
  });
  const scoped = bots.filter((b: any) => !b.telegramBotId || b.telegramBotId === botId);
  const text = (input || '').toLowerCase();
  const byKeyword = scoped.find((b: any) =>
    (b.triggerKeywords || []).some((k: string) => k && text.includes(String(k).toLowerCase()))
  );
  return byKeyword || scoped.find((b: any) => b.isDefault) || null;
};

/**
 * Run the flow for one inbound message. Returns true if the flow handled it
 * (so the caller should skip keyword auto-replies). `input` is the message text
 * or, for a button tap, the callback_data we previously sent.
 */
export const runTelegramFlow = async (
  organizationId: string,
  conversation: { id: string; contactId?: string },
  bot: { id: string },
  input: string
): Promise<boolean> => {
  const conversationId = conversation.id;
  let session = await getSession(conversationId);

  let chatbot: any = null;
  let flow: FlowData | null = null;
  let startNodeId: string | undefined;

  if (session) {
    chatbot = await prisma.chatbot.findFirst({
      where: { id: session.chatbotId, organizationId, channel: 'TELEGRAM', status: 'ACTIVE' },
    });
    if (!chatbot) { await clearSession(conversationId); session = null; }
    else {
      flow = chatbot.flowData as unknown as FlowData;
      // Resolve where to go from the parked node using this input.
      const waitNode = getNode(flow, session.waitNodeId);
      if (!waitNode) { await clearSession(conversationId); session = null; }
      else if (session.waitKind === 'button') {
        const hit = session.waitButtons?.find((b) => b.token === input.trim());
        if (hit) {
          // Branch by an edge whose handle is the button id, else the button's
          // own nextNodeId, else the node's default edge.
          const edge = nextEdge(flow, waitNode.id, hit.id);
          startNodeId = edge?.target || hit.nextNodeId || nextEdge(flow, waitNode.id)?.target;
        } else {
          // Typed instead of tapping — try a default edge; else let auto-reply try.
          const edge = nextEdge(flow, waitNode.id);
          if (!edge) return false;
          startNodeId = edge.target;
        }
      } else {
        // Input node: capture the answer, then follow the single edge.
        const varName = String((waitNode.data as any).variableName || waitNode.data.label || waitNode.id).replace(/\s+/g, '_');
        session.variables[varName] = input;
        const edge = nextEdge(flow, waitNode.id);
        startNodeId = edge?.target;
      }
    }
  }

  if (!session) {
    chatbot = await findMatchingChatbot(organizationId, bot.id, input);
    if (!chatbot) return false;
    flow = chatbot.flowData as unknown as FlowData;
    if (!flow?.nodes?.length) return false;
    const start = flow.nodes.find((n) => n.type === 'start') || flow.nodes[0];
    const edge = nextEdge(flow, start.id);
    startNodeId = edge?.target || start.id;
    session = { chatbotId: chatbot.id, waitNodeId: '', waitKind: 'input', variables: {}, updatedAt: Date.now() };
  }

  if (!flow || !startNodeId) { await clearSession(conversationId); return session ? true : false; }

  const handled = await advance(organizationId, conversationId, flow, startNodeId, input, session);
  return handled;
};

/** Walk the flow from `nodeId` until it needs to wait for input or ends. */
const advance = async (
  organizationId: string,
  conversationId: string,
  flow: FlowData,
  nodeId: string,
  lastInput: string,
  session: FlowSession
): Promise<boolean> => {
  const { sendTelegramMessage } = await import('./telegram.service');

  let currentId: string | undefined = nodeId;
  let steps = 0;
  let didSomething = false;

  while (currentId && steps < MAX_STEPS) {
    steps++;
    const node = getNode(flow, currentId);
    if (!node) break;

    if (node.type === 'start') {
      currentId = nextEdge(flow, node.id)?.target;
      continue;
    }

    if (node.type === 'message' || node.type === 'question') {
      const text = nodeText(node) || (node.data.mediaUrl || '');
      if (text) { await sendTelegramMessage(organizationId, conversationId, text).catch(() => {}); didSomething = true; }
      // A "wait for input" message (or legacy question node) parks here and stores
      // the customer's next message as a variable before following its edge.
      if ((node.data as any).waitForInput || node.type === 'question') {
        session.waitNodeId = node.id;
        session.waitKind = 'input';
        session.waitButtons = undefined;
        await setSession(conversationId, session);
        return true;
      }
      currentId = nextEdge(flow, node.id)?.target;
      continue;
    }

    if (node.type === 'button' || node.type === 'list') {
      const text = nodeText(node) || node.data.label || 'Choose an option:';
      const opts: { id: string; token: string; nextNodeId?: string }[] = [];
      const buttons: { text: string; type: 'callback' | 'url'; value: string }[] = [];

      if (node.type === 'button') {
        (node.data.buttons || []).forEach((b, i) => {
          const label = btnText(b) || `Option ${i + 1}`;
          if (b.type === 'url' && b.value) {
            buttons.push({ text: label, type: 'url', value: b.value });
          } else {
            const token = `fb:${i}`;
            buttons.push({ text: label, type: 'callback', value: token });
            opts.push({ id: b.id, token, nextNodeId: b.nextNodeId });
          }
        });
      } else {
        const rows = (node.data.listSections || []).flatMap((s) => s.rows || []);
        rows.forEach((r, i) => {
          const token = `fb:${i}`;
          buttons.push({ text: r.title, type: 'callback', value: token });
          opts.push({ id: r.id, token });
        });
      }

      if (buttons.length === 0) { currentId = nextEdge(flow, node.id)?.target; continue; }

      await sendTelegramMessage(organizationId, conversationId, text, buttons).catch(() => {});
      // Park here and wait for the user's tap.
      session.waitNodeId = node.id;
      session.waitKind = 'button';
      session.waitButtons = opts;
      await setSession(conversationId, session);
      return true;
    }

    if (node.type === 'condition') {
      const ok = evalCondition(node.data.condition, lastInput, session.variables);
      currentId = nextEdge(flow, node.id, ok ? 'true' : 'false')?.target;
      continue;
    }

    if (node.type === 'delay') {
      // Long waits don't fit a webhook request; treat as a pass-through.
      currentId = nextEdge(flow, node.id)?.target;
      continue;
    }

    if (node.type === 'action') {
      await runAction(organizationId, conversationId, node).catch(() => {});
      currentId = nextEdge(flow, node.id)?.target;
      continue;
    }

    if (node.type === 'ai') {
      try {
        const { aiService } = await import('../chatbot/ai.service');
        const prompt = node.data.systemPrompt || 'You are a helpful assistant. Reply concisely.';
        const answer = await aiService.generateResponse(prompt, lastInput || 'Hello', []);
        if (answer && answer.trim()) { await sendTelegramMessage(organizationId, conversationId, answer.trim()).catch(() => {}); didSomething = true; }
      } catch { /* AI is best-effort */ }
      currentId = nextEdge(flow, node.id)?.target;
      continue;
    }

    // Unknown node type — stop.
    break;
  }

  // Reached a terminal node (no more edges) — the flow is complete.
  await clearSession(conversationId);
  return didSomething;
};

/** Apply an action node: assign the conversation or tag the contact. */
const runAction = async (organizationId: string, conversationId: string, node: FlowNode) => {
  const action = node.data.action;
  if (!action) return;
  const type = action.type || '';
  const params = action.params || {};

  if (type === 'assign' || type === 'notify_agent') {
    const userId = action.value || params.assignUserId || params.value;
    if (userId) {
      await prisma.conversation.updateMany({
        where: { id: conversationId, organizationId },
        data: { assignedTo: String(userId) },
      });
    }
  } else if (type === 'tag' || type === 'add_tag') {
    const tagValues: string[] = action.value
      ? [action.value]
      : Array.isArray(params.tagNames) ? params.tagNames : (params.value ? [params.value] : []);
    if (tagValues.length) {
      const conv = await prisma.conversation.findFirst({ where: { id: conversationId, organizationId }, select: { contactId: true } });
      if (conv?.contactId) {
        const contact = await prisma.contact.findUnique({ where: { id: conv.contactId }, select: { tags: true } });
        const tags = new Set([...(contact?.tags || []), ...tagValues.map(String)]);
        await prisma.contact.update({ where: { id: conv.contactId }, data: { tags: Array.from(tags) } });
      }
    }
  }
};

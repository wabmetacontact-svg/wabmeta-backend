/**
 * Pure AI-agent helpers: prompt, Gemini history, callback time, routing.
 * No database: only the test guard's DATABASE_URL string is needed.
 */
import { describe, expect, it } from 'vitest';
import {
  AgentConfig,
  MAX_KNOWLEDGE_CHARS,
  buildAgentPrompt,
  buildHistory,
  enabledHandoffReasons,
  isHighValue,
  parseCallbackTime,
  shouldAiReply,
} from './aiagent.prompt';

const agent: AgentConfig = {
  name: 'Riya',
  businessInfo: 'We build websites in Pune. Open 10am-7pm, Mon-Sat.',
  instructions: 'Always offer a free consultation.',
  timezone: 'Asia/Kolkata',
  handoffOnRequest: true,
  handoffOnComplaint: true,
  handoffOnUnknown: true,
  handoffDealAbove: 100000,
};

const now = new Date('2026-09-11T10:00:00Z'); // 15:30 IST

describe('buildAgentPrompt', () => {
  const prompt = buildAgentPrompt({
    agent,
    businessName: 'Acme Web',
    knowledge: [
      { type: 'PRODUCT', title: 'Business website', content: '5 pages, 1 month support', price: 25000, currency: 'INR' },
      { type: 'PRODUCT', title: 'Custom app', content: 'Quoted after a call', price: null, currency: 'INR' },
      { type: 'FAQ', title: 'Do you do SEO?', content: 'Yes, basic SEO is included.', price: null, currency: 'INR' },
    ],
    customer: { name: 'Priya', city: 'Pune' },
    stageNames: ['New Lead', 'Qualified', 'Proposal'],
    now,
  });

  it('carries the business, catalogue with INR prices, and FAQs', () => {
    expect(prompt).toContain('You are Riya, the WhatsApp sales assistant for Acme Web');
    expect(prompt).toContain('We build websites in Pune');
    expect(prompt).toContain('- Business website - ₹25,000');
    expect(prompt).toContain('- Custom app - price not listed');
    expect(prompt).toContain('Q: Do you do SEO?\nA: Yes, basic SEO is included.');
  });

  it('forbids invented prices and knows the customer', () => {
    expect(prompt).toContain('Never invent or estimate a price');
    expect(prompt).toContain('Name: Priya');
    expect(prompt).toContain('City: Pune');
    expect(prompt).toContain('Do not ask again');
  });

  it('lists the allowed stages and the local time with its offset', () => {
    expect(prompt).toContain('"New Lead", "Qualified", "Proposal"');
    expect(prompt).toContain('+05:30');
    expect(prompt).toContain('15:30');
  });

  it('includes every enabled handoff rule and the owner instructions', () => {
    expect(prompt).toContain('reason "customer_request"');
    expect(prompt).toContain('reason "complaint"');
    expect(prompt).toContain('reason "unknown_answer"');
    expect(prompt).toContain('above ₹1,00,000');
    expect(prompt).toContain('Always offer a free consultation.');
  });

  it('drops disabled handoff rules and falls back to "never guess"', () => {
    const p = buildAgentPrompt({
      agent: { ...agent, handoffOnComplaint: false, handoffOnUnknown: false, handoffDealAbove: null },
      businessName: 'Acme', knowledge: [], customer: {}, stageNames: [], now,
    });
    expect(p).not.toContain('reason "complaint"');
    expect(p).not.toContain('reason "unknown_answer"');
    expect(p).not.toContain('high_value');
    expect(p).toContain('Never guess.');
    expect(p).toContain('No products or prices are listed. Do not quote any price.');
    expect(p).toContain('Do not call update_lead_stage.');
  });

  it('caps a huge knowledge base and says how much it left out', () => {
    const big = Array.from({ length: 400 }, (_, i) => ({
      type: 'FAQ', title: `Question ${i}`, content: 'x'.repeat(200), price: null, currency: 'INR',
    }));
    const p = buildAgentPrompt({ agent, businessName: 'Acme', knowledge: big, customer: {}, stageNames: [], now });
    expect(p.length).toBeLessThan(MAX_KNOWLEDGE_CHARS + 5000);
    expect(p).toMatch(/\(\d+ more item\(s\) not shown\)/);
  });
});

describe('enabledHandoffReasons', () => {
  it('maps the toggles and the amount', () => {
    expect(enabledHandoffReasons(agent)).toEqual(['customer_request', 'complaint', 'unknown_answer', 'high_value']);
    expect(enabledHandoffReasons({ ...agent, handoffOnRequest: false, handoffDealAbove: null }))
      .toEqual(['complaint', 'unknown_answer']);
  });
});

describe('buildHistory', () => {
  it('starts with the customer, merges runs, and ends on our turn', () => {
    const h = buildHistory([
      { direction: 'OUTBOUND', content: 'Diwali offer template' }, // campaign first - dropped
      { direction: 'INBOUND', content: 'Hi' },
      { direction: 'INBOUND', content: 'price?' },
      { direction: 'OUTBOUND', content: 'It is ₹25,000' },
      { direction: 'INBOUND', content: '   ' }, // empty - dropped
      { direction: 'INBOUND', content: 'ok one more thing' }, // trailing user - dropped
    ]);
    expect(h).toEqual([
      { role: 'user', content: 'Hi\nprice?' },
      { role: 'model', content: 'It is ₹25,000' },
    ]);
  });

  it('keeps at most the last 20 turns', () => {
    const many = Array.from({ length: 60 }, (_, i) => ({ direction: i % 2 ? 'OUTBOUND' : 'INBOUND', content: `m${i}` }));
    const h = buildHistory(many);
    expect(h.length).toBeLessThanOrEqual(20);
    expect(h[0].role).toBe('user');
    expect(h[h.length - 1].role).toBe('model');
  });
});

describe('parseCallbackTime', () => {
  it('accepts a future time with an offset', () => {
    expect(parseCallbackTime('2026-09-12T17:00:00+05:30', now)?.toISOString()).toBe('2026-09-12T11:30:00.000Z');
    expect(parseCallbackTime('2026-09-12T11:30:00Z', now)).not.toBeNull();
  });

  it('rejects no offset, the past, far future and junk', () => {
    expect(parseCallbackTime('2026-09-12T17:00:00', now)).toBeNull();
    expect(parseCallbackTime('2026-09-10T17:00:00+05:30', now)).toBeNull();
    expect(parseCallbackTime('2027-09-12T17:00:00+05:30', now)).toBeNull();
    expect(parseCallbackTime('tomorrow 5pm', now)).toBeNull();
    expect(parseCallbackTime(undefined, now)).toBeNull();
  });
});

describe('isHighValue', () => {
  it('compares against the threshold only when one is set', () => {
    expect(isHighValue(150000, 100000)).toBe(true);
    expect(isHighValue('100000', 100000)).toBe(true);
    expect(isHighValue(99999, 100000)).toBe(false);
    expect(isHighValue(150000, null)).toBe(false);
    expect(isHighValue('lots', 100000)).toBe(false);
  });
});

describe('shouldAiReply', () => {
  const base = {
    agentEnabled: true, paused: false, handledByAutomation: false, handledByChatbot: false, msgType: 'TEXT', text: 'hi',
  };
  it('replies only when nobody else did, the chat is not paused, and it is text', () => {
    expect(shouldAiReply(base)).toBe(true);
    expect(shouldAiReply({ ...base, agentEnabled: false })).toBe(false);
    expect(shouldAiReply({ ...base, paused: true })).toBe(false);
    expect(shouldAiReply({ ...base, handledByAutomation: true })).toBe(false);
    expect(shouldAiReply({ ...base, handledByChatbot: true })).toBe(false);
    expect(shouldAiReply({ ...base, msgType: 'IMAGE' })).toBe(false);
    expect(shouldAiReply({ ...base, text: '  ' })).toBe(false);
  });
});

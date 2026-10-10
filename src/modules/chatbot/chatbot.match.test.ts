import { describe, expect, it } from 'vitest';
import { inputPicksOption, keywordChatbot, pickChatbot, replyBelongsToNode } from './chatbot.match';
import { keywordTriggerMatches } from '../automation/automation.keyword';

const sales = { id: 'sales', isDefault: false, triggerKeywords: ['price', 'menu'] };
const hiring = { id: 'hiring', isDefault: false, triggerKeywords: ['hiring'] };
const welcome = { id: 'welcome', isDefault: true, triggerKeywords: [] };

describe('pickChatbot', () => {
  it('picks by exact keyword, then by keyword inside the message', () => {
    expect(pickChatbot([sales, hiring], 'MENU', false)?.id).toBe('sales');
    expect(pickChatbot([sales, hiring], 'what is the price?', false)?.id).toBe('sales');
  });

  it('no longer matches a keyword that merely contains the message', () => {
    // "hi" used to start the "hiring" bot because "hiring".includes("hi")
    expect(pickChatbot([hiring], 'hi', false)).toBeNull();
  });

  it('starts the default bot only on a new chat', () => {
    expect(pickChatbot([sales, welcome], 'hello', true)?.id).toBe('welcome');
    expect(pickChatbot([sales, welcome], 'hello', false)).toBeNull();
  });

  it('a lone keyword-only bot is not treated as the default', () => {
    expect(pickChatbot([sales], 'hello', true)).toBeNull();
  });

  it('a lone bot with no keywords still answers new chats (it could never run otherwise)', () => {
    const only = { id: 'only', isDefault: false, triggerKeywords: [] };
    expect(pickChatbot([only], 'hello', true)?.id).toBe('only');
  });

  it('ignores empty keywords', () => {
    const blank = { id: 'blank', isDefault: false, triggerKeywords: ['', '  '] };
    expect(keywordChatbot([blank], 'anything')).toBeNull();
  });

  it('exactOnly skips partial matches', () => {
    expect(keywordChatbot([sales], 'what is the price', { exactOnly: true })).toBeNull();
    expect(keywordChatbot([sales], ' Price ', { exactOnly: true })?.id).toBe('sales');
  });
});

describe('button / list ownership', () => {
  const buttons = {
    type: 'button',
    data: { buttons: [{ id: 'btn-a', text: 'Price' }, { id: 'btn-b', text: 'Support' }] },
  };
  const list = {
    type: 'list',
    data: { listSections: [{ rows: [{ id: 'row-1', title: 'Plans' }] }] },
  };

  it('knows its own reply ids', () => {
    expect(replyBelongsToNode(buttons, 'btn-b')).toBe(true);
    expect(replyBelongsToNode(list, 'row-1')).toBe(true);
    expect(replyBelongsToNode(buttons, 'auto_btn_1')).toBe(false);
    expect(replyBelongsToNode({ type: 'message' }, 'btn-a')).toBe(false);
  });

  it('a typed option title counts as picking that option', () => {
    expect(inputPicksOption(buttons, 'price')).toBe(true);
    expect(inputPicksOption(buttons, 'menu')).toBe(false);
  });
});

describe('keywordTriggerMatches (automation)', () => {
  it('contains / exact as configured', () => {
    expect(keywordTriggerMatches({ keywords: ['price'] }, 'Price kya hai?')).toBe(true);
    expect(keywordTriggerMatches({ keywords: ['price'], exactMatch: true }, 'price kya hai')).toBe(false);
    expect(keywordTriggerMatches({ keywords: ['price'], exactMatch: true }, ' PRICE ')).toBe(true);
  });

  it('an empty keyword left by a trailing comma does not match every message', () => {
    // web form saves "hi, hello," as ['hi', 'hello', '']
    expect(keywordTriggerMatches({ keywords: ['hi', 'hello', ''] }, 'order status')).toBe(false);
  });

  it('copes with missing config', () => {
    expect(keywordTriggerMatches(null, 'hi')).toBe(false);
    expect(keywordTriggerMatches({ keywords: ['hi'] }, '')).toBe(false);
  });
});

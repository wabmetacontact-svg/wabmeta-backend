// Kaun sa WhatsApp chatbot kis message par chalega - bina DB ke, taaki test ho sake.

export interface MatchableBot {
  id: string;
  isDefault?: boolean | null;
  triggerKeywords?: string[] | null;
}

interface ChoiceNode {
  type: string;
  data?: {
    buttons?: Array<{ id: string; text: string }>;
    listSections?: Array<{ rows?: Array<{ id: string; title: string }> }>;
  };
}

const norm = (s: unknown) => String(s ?? '').toLowerCase().trim();

const keywordsOf = (bot: MatchableBot) =>
  (bot.triggerKeywords || []).map(norm).filter(Boolean);

/**
 * Keyword se bot. Exact pehle, phir "message me keyword hai".
 * Ulta ("keyword me message hai") ab nahi: "hi" bhejne par "hiring" wala bot
 * chal jata tha. Khaali keyword kabhi match nahi karta.
 */
export function keywordChatbot<T extends MatchableBot>(
  bots: T[],
  message: string,
  opts: { exactOnly?: boolean } = {}
): T | null {
  const msg = norm(message);
  if (!msg) return null;

  const exact = bots.find((b) => keywordsOf(b).includes(msg));
  if (exact || opts.exactOnly) return exact || null;

  return bots.find((b) => keywordsOf(b).some((kw) => msg.includes(kw))) || null;
}

/**
 * Bina session ke aaye message ke liye bot: keyword, warna nayi chat par
 * Default bot. Builder "Default OFF" ko "Only triggered by keywords" kehta
 * hai, isliye akela active bot ab default nahi banta - sirf tab jab uske
 * koi keyword hi na hon (warna wo kabhi chal hi nahi sakta).
 */
export function pickChatbot<T extends MatchableBot>(
  bots: T[],
  message: string,
  isNewConversation: boolean
): T | null {
  const byKeyword = keywordChatbot(bots, message);
  if (byKeyword) return byKeyword;
  if (!isNewConversation) return null;

  const defaultBot = bots.find((b) => b.isDefault);
  if (defaultBot) return defaultBot;
  if (bots.length === 1 && keywordsOf(bots[0]).length === 0) return bots[0];
  return null;
}

/** Button/list node ke options ki ids aur titles. */
function optionsOf(node: ChoiceNode | null | undefined): Array<{ id: string; title: string }> {
  if (!node) return [];
  if (node.type === 'button') {
    return (node.data?.buttons || []).map((b) => ({ id: b.id, title: b.text }));
  }
  if (node.type === 'list') {
    return (node.data?.listSections || []).flatMap((s) => s.rows || []);
  }
  return [];
}

/** Ye button/list tap (reply id) isi node ke kisi option ka hai? */
export function replyBelongsToNode(node: ChoiceNode | null | undefined, replyId: string): boolean {
  if (!replyId) return false;
  return optionsOf(node).some((o) => o.id === replyId);
}

/** Input is node ke kisi option ki id ya poora title hai? (keyword restart se bachane ko) */
export function inputPicksOption(node: ChoiceNode | null | undefined, input: string): boolean {
  const msg = norm(input);
  if (!msg) return false;
  return optionsOf(node).some((o) => o.id === input || norm(o.title) === msg);
}

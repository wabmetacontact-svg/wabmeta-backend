// src/modules/crm/crm.social.ts
//
// Telegram aur Instagram DM se aaye contacts ko CRM lead banata hai.
//
// WhatsApp par ye kaam chatbot aur AI agent karte hain - wo customer ko
// qualify karke smartCreateLead bulate hain. In do channels par abhi koi
// qualify karne wala nahi hai (na chatbot engine chalta hai, na AI agent),
// isliye trigger simple rakha hai: customer ka pehla *asli* message.
//
// "Asli" ka matlab: bare /start, inline button tap, ya akela "hi" nahi.
// Warna har galti se aaya hua message CRM me lead ban jata aur pipeline
// kachre se bhar jati. Greeting par lead na banne se kuch khota nahi -
// usi contact ka agla message lead bana dega.

/** Akela greeting lead nahi hai. Lowercase, trailing punctuation hata kar match hota hai. */
const GREETINGS = new Set([
  'hi', 'hii', 'hiii', 'hy', 'hey', 'heyy', 'helo', 'hello', 'hlo', 'hola',
  'namaste', 'namaskar', 'salam', 'assalamualaikum', 'sat sri akal',
  'gm', 'gn', 'good morning', 'good afternoon', 'good evening', 'good night',
  'ok', 'okay', 'k', 'kk', 'hmm', 'hm', 'yes', 'no', 'ha', 'haan', 'nahi',
  'thanks', 'thank you', 'thx', 'ty', 'welcome',
  'test', 'testing',
]);

/**
 * Ye message lead banane layak hai ya nahi.
 * Pure function - alag se test hota hai, koi DB call nahi.
 */
export function isQualifyingSocialText(raw: string | null | undefined): boolean {
  const text = (raw || '').trim();

  if (text.length < 2) return false;      // "k", akela emoji, khali string
  if (text.startsWith('/')) return false; // /start, /help - Telegram commands

  // Trailing punctuation aur bar-bar wale letters hata kar dekho: "hii!!!" bhi greeting hai.
  const normalized = text
    .toLowerCase()
    .replace(/[!.?,]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  if (GREETINGS.has(normalized)) return false;

  return true;
}

/**
 * Telegram/Instagram ke inbound message par CRM lead banata hai - agar org ne
 * ye band nahi kiya hai aur message lead layak hai.
 *
 * Ye kabhi throw nahi karta. Inbound message save ho chuka hota hai jab ye
 * chalta hai; CRM fail hone par message inbox me rukna nahi chahiye.
 */
export async function maybeCreateSocialLead(input: {
  organizationId: string;
  contactId: string;
  conversationId: string;
  channel: 'TELEGRAM' | 'INSTAGRAM';
  text: string | null | undefined;
}): Promise<void> {
  try {
    // Sabse sasta check pehle - zyadatar messages yahin ruk jate hain, bina DB chhue.
    if (!isQualifyingSocialText(input.text)) return;

    const { crmService } = await import('./crm.service');

    const settings = await crmService.getOrCreateSettings(input.organizationId);
    if (settings?.autoLeadFromSocial === false) return;

    // smartCreateLead khud dedup karta hai: contact ka pehle se koi open lead
    // (WON/LOST ke alawa) ho to naya nahi banta, wahi update hota hai.
    await crmService.smartCreateLead({
      organizationId: input.organizationId,
      contactId: input.contactId,
      conversationId: input.conversationId,
      source: input.channel === 'TELEGRAM' ? 'telegram' : 'instagram_dm',
    });
  } catch (err: any) {
    console.error('maybeCreateSocialLead error:', err?.message || err);
  }
}

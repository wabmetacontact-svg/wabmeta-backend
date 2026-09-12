// src/modules/contacts/contact.channel.ts
//
// Telegram aur Instagram ke contacts ek synthetic phone par bante hain -
// "tg:<userId>" / "ig:<igsid>" - kyunki Contact.phone unique hai aur un
// channels par asli mobile number hota hi nahi.
//
// Wo rows do jagah ghus jati thi: Contacts list (jo bhar jati thi) aur
// WhatsApp campaigns ka audience (jahan un par bhejna hi mumkin nahi -
// Meta "tg:123" ko reject karta hai, par wo totalContacts me gina ja chuka
// hota hai). Dono jagah ab yahi filter lagta hai.
//
// Pehchan telegramUserId / instagramUserId se hoti hai; phone prefix bhi
// saath me check hota hai taaki koi purani row chhoot na jaye.

import { Prisma } from '@prisma/client';

export type ContactChannel = 'ALL' | 'WHATSAPP' | 'TELEGRAM' | 'INSTAGRAM';

export const CONTACT_CHANNELS: ContactChannel[] = ['ALL', 'WHATSAPP', 'TELEGRAM', 'INSTAGRAM'];

/**
 * Query string se channel. Kuch na aaye to WHATSAPP - Contacts list ka
 * default yahi hai, taaki Telegram/Instagram wale contacts list na bharein.
 */
export const parseContactChannel = (raw: unknown): ContactChannel => {
  const v = String(raw ?? '').trim().toUpperCase();
  return (CONTACT_CHANNELS as string[]).includes(v) ? (v as ContactChannel) : 'WHATSAPP';
};

/** Synthetic phone wali rows chhod do. */
const NOT_SYNTHETIC_PHONE: Prisma.ContactWhereInput = {
  NOT: [{ phone: { startsWith: 'tg:' } }, { phone: { startsWith: 'ig:' } }],
};

export const contactChannelWhere = (channel: ContactChannel): Prisma.ContactWhereInput => {
  switch (channel) {
    case 'ALL':
      return {};
    case 'TELEGRAM':
      return { telegramUserId: { not: null } };
    case 'INSTAGRAM':
      return { instagramUserId: { not: null } };
    case 'WHATSAPP':
    default:
      return { telegramUserId: null, instagramUserId: null, ...NOT_SYNTHETIC_PHONE };
  }
};

/**
 * WhatsApp par bheja ja sakta hai ya nahi. Campaign audience isi se chhanta
 * hai - campaign hamesha ek WhatsApp account se jata hai.
 */
export const whatsappReachableContactWhere = contactChannelWhere('WHATSAPP');

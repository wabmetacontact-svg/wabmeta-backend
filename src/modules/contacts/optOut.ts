// src/modules/contacts/optOut.ts
//
// WhatsApp ki Business Messaging Policy kehti hai ki jo person "STOP" bole,
// use aage marketing nahi jani chahiye. Pehle ye kahin handle hi nahi hota tha:
// contact ACTIVE hi rehta tha, agla campaign phir usi ko jata tha, aur wo
// WhatsApp me Block/Report dabata tha. Wahi quality rating girati hai aur
// aakhir me number ban hota hai.
//
// Campaigns pehle se sirf status ACTIVE waale contacts ko bhejte hain
// (campaigns.service.ts), to bas contact ko UNSUBSCRIBED karna kaafi hai.

import prisma from '../../config/database';

/**
 * Ye poore message se match karte hain, andar se nahi.
 *
 * "stop" ko substring maana jaye to "bus stop par milte hain" ya "don't stop"
 * jaise messages bhi opt-out ban jayenge - aur ek galat opt-out ka matlab hai
 * customer hamesha ke liye chala gaya. Isliye jaan bujh kar conservative hai.
 */
const OPT_OUT_PHRASES = new Set([
  'stop',
  'stop promotions',      // WhatsApp ka apna "Stop promotions" button yahi bhejta hai
  'stop promotion',
  'unsubscribe',
  'unsub',
  'opt out',
  'optout',
  'remove me',
  'band karo',
  'band kro',
  'band kar do',
  'mat bhejo',
  'message mat bhejo',
]);

const OPT_IN_PHRASES = new Set([
  'start',
  'subscribe',
  'resume',
  'unstop',
  'chalu karo',
]);

/**
 * Lowercase, aage-peeche ki space hatao, aur end ke punctuation ("STOP!",
 * "stop.") ko ignore karo. Beech ka punctuation chhodte hain, warna
 * "stop-and-search" jaise phrases match karne lagenge.
 */
function normalise(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[!.?,;:\s]+$/u, '')
    .replace(/\s+/gu, ' ');
}

export type OptSignal = 'OPT_OUT' | 'OPT_IN' | null;

export function detectOptSignal(text: string | null | undefined): OptSignal {
  if (!text) return null;
  const t = normalise(text);
  if (!t || t.length > 40) return null;   // lamba message kabhi command nahi hota
  if (OPT_OUT_PHRASES.has(t)) return 'OPT_OUT';
  if (OPT_IN_PHRASES.has(t)) return 'OPT_IN';
  return null;
}

/**
 * Contact ka status badalta hai. Sirf tab likhta hai jab actually badla ho,
 * taaki har "stop" par bekaar ka write na ho.
 *
 * Return: true agar is message ko opt-out samajh kar aage ka processing
 * (chatbot/automation reply) rok dena chahiye.
 */
export async function applyOptSignal(
  signal: Exclude<OptSignal, null>,
  contactId: string,
  organizationId: string
): Promise<boolean> {
  const nextStatus = signal === 'OPT_OUT' ? 'UNSUBSCRIBED' : 'ACTIVE';

  try {
    const result = await prisma.contact.updateMany({
      // organizationId bhi match karo - contactId kisi aur org ka nahi hona chahiye
      where: { id: contactId, organizationId, status: { not: nextStatus as any } },
      data: { status: nextStatus as any },
    });

    if (result.count > 0) {
      console.log(
        `${signal === 'OPT_OUT' ? '🚫' : '✅'} ${signal} - contact ${contactId} -> ${nextStatus}`
      );
    }
  } catch (err: any) {
    // Status likhne me fail ho to inbound message process hona nahi rukna chahiye
    console.error('Opt signal update failed:', err?.message);
  }

  // Opt-out ke baad bot ka jawab bhejna sabse kharab cheez hai - user ne abhi
  // abhi ruk jane ko kaha hai. Opt-in par bot normal chalta rahe.
  return signal === 'OPT_OUT';
}

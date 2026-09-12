// Ye filter do jagah lagta hai - Contacts list aur campaign audience. Galat
// hua to ya to contacts gayab ho jayenge, ya campaign un par bhejne lagega
// jahan bheja hi nahi ja sakta. Isliye alag se test.

import { describe, it, expect } from 'vitest';
import {
  parseContactChannel,
  contactChannelWhere,
  whatsappReachableContactWhere,
} from './contact.channel';

describe('parseContactChannel', () => {
  it('valid channel waisa hi lautata hai, case chahe kuch bhi ho', () => {
    expect(parseContactChannel('TELEGRAM')).toBe('TELEGRAM');
    expect(parseContactChannel('telegram')).toBe('TELEGRAM');
    expect(parseContactChannel(' instagram ')).toBe('INSTAGRAM');
    expect(parseContactChannel('ALL')).toBe('ALL');
  });

  it('missing ya bakwaas value par WHATSAPP par girta hai', () => {
    expect(parseContactChannel(undefined)).toBe('WHATSAPP');
    expect(parseContactChannel(null)).toBe('WHATSAPP');
    expect(parseContactChannel('')).toBe('WHATSAPP');
    expect(parseContactChannel('sms')).toBe('WHATSAPP');
    expect(parseContactChannel(42)).toBe('WHATSAPP');
  });
});

describe('contactChannelWhere', () => {
  it('WHATSAPP dono social ids null maangta hai aur synthetic phone hatata hai', () => {
    expect(whatsappReachableContactWhere).toEqual({
      telegramUserId: null,
      instagramUserId: null,
      NOT: [{ phone: { startsWith: 'tg:' } }, { phone: { startsWith: 'ig:' } }],
    });
  });

  it('TELEGRAM aur INSTAGRAM sirf apne contacts maangte hain', () => {
    expect(contactChannelWhere('TELEGRAM')).toEqual({ telegramUserId: { not: null } });
    expect(contactChannelWhere('INSTAGRAM')).toEqual({ instagramUserId: { not: null } });
  });

  it('ALL kuch filter nahi karta', () => {
    expect(contactChannelWhere('ALL')).toEqual({});
  });
});

// Numbers ki limit wahi cheez hai jo Pro (2) aur Business (3) me bech rahe
// hain. Dheeli hui to log bina paise diye numbers jodte rahenge; kasi hui to
// paying customer ko wo nahi milega jiska usne paisa diya.

import { describe, it, expect } from 'vitest';
import {
  accountLimitFor,
  canConnectAnother,
  limitReachedMessage,
  DEFAULT_MAX_ACCOUNTS,
} from './accountLimit';

describe('accountLimitFor', () => {
  it('plan ki limit waisi hi lagti hai', () => {
    expect(accountLimitFor(1)).toBe(1);
    expect(accountLimitFor(2)).toBe(2);
    expect(accountLimitFor(3)).toBe(3);
  });

  it('limit na mile to 1 - aaj ka behaviour, aur surakshit taraf', () => {
    expect(accountLimitFor(null)).toBe(DEFAULT_MAX_ACCOUNTS);
    expect(accountLimitFor(undefined)).toBe(DEFAULT_MAX_ACCOUNTS);
    expect(accountLimitFor(0)).toBe(DEFAULT_MAX_ACCOUNTS);
    expect(accountLimitFor(-2)).toBe(DEFAULT_MAX_ACCOUNTS);
    expect(accountLimitFor(NaN)).toBe(DEFAULT_MAX_ACCOUNTS);
    expect(accountLimitFor('abc' as any)).toBe(DEFAULT_MAX_ACCOUNTS);
  });

  it('adha number kabhi nahi - neeche hi kaata jata hai', () => {
    expect(accountLimitFor(2.9)).toBe(2);
  });
});

describe('canConnectAnother', () => {
  it('limit se kam juda ho to haan', () => {
    expect(canConnectAnother(0, 1)).toBe(true);
    expect(canConnectAnother(1, 2)).toBe(true);
    expect(canConnectAnother(2, 3)).toBe(true);
  });

  it('limit bhar chuki ho to nahi', () => {
    expect(canConnectAnother(1, 1)).toBe(false);
    expect(canConnectAnother(2, 2)).toBe(false);
    expect(canConnectAnother(3, 3)).toBe(false);
  });

  it('kisi wajah se limit se upar ho gaya ho to bhi nahi', () => {
    expect(canConnectAnother(5, 3)).toBe(false);
  });

  it('Pro par doosra number jud sakta hai - pehle ye hi nahi hota tha', () => {
    expect(canConnectAnother(1, 2)).toBe(true);
  });
});

describe('limitReachedMessage', () => {
  it('ek number wale plan par saaf bhasha', () => {
    const m = limitReachedMessage(1, 1);
    expect(m).toContain('one WhatsApp number');
    expect(m).toContain('upgrade');
  });

  it('zyada numbers wale plan par ginti dikhti hai', () => {
    const m = limitReachedMessage(2, 2);
    expect(m).toContain('2 WhatsApp numbers');
    expect(m).toContain('2 are already connected');
  });
});

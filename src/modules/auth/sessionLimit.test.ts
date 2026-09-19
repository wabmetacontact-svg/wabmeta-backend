// Ye cap seedha logins par lagta hai. Zyada dheela hua to ek login poori team
// me baant diya jayega aur seats kabhi nahi bikenge; zyada kasa hua to genuine
// user apne hi phone se logout hota rahega. Dono galtiyan mehengi hain.

import { describe, it, expect } from 'vitest';
import {
  sessionCapForSeats,
  sessionsToEvict,
  DEVICES_PER_SEAT,
  MIN_SESSION_CAP,
} from './sessionLimit';

const at = (iso: string) => new Date(iso);

describe('sessionCapForSeats', () => {
  it('seats ke hisaab se cap, har seat par do device', () => {
    expect(sessionCapForSeats(3)).toBe(3 * DEVICES_PER_SEAT);
    expect(sessionCapForSeats(5)).toBe(5 * DEVICES_PER_SEAT);
    expect(sessionCapForSeats(10)).toBe(10 * DEVICES_PER_SEAT);
  });

  it('ek seat wale ko bhi kam se kam do sessions milte hain', () => {
    // Warna laptop par login karte hi phone se logout ho jata.
    expect(sessionCapForSeats(1)).toBeGreaterThanOrEqual(MIN_SESSION_CAP);
  });

  it('unlimited seats par koi cap nahi', () => {
    expect(sessionCapForSeats(999999)).toBeNull();
  });

  it('plan ya value missing ho to cap nahi - adhoore data par kisi ko logout mat karo', () => {
    expect(sessionCapForSeats(null)).toBeNull();
    expect(sessionCapForSeats(undefined)).toBeNull();
    expect(sessionCapForSeats(0)).toBeNull();
    expect(sessionCapForSeats(-5)).toBeNull();
    expect(sessionCapForSeats(NaN)).toBeNull();
  });
});

describe('sessionsToEvict', () => {
  const sessions = [
    { id: 'c', createdAt: at('2026-09-19T12:00:00Z') },
    { id: 'a', createdAt: at('2026-09-19T10:00:00Z') },
    { id: 'b', createdAt: at('2026-09-19T11:00:00Z') },
  ];

  it('cap null ho to kuch nahi hatta', () => {
    expect(sessionsToEvict(sessions, null)).toEqual([]);
  });

  it('jagah bachi ho to kuch nahi hatta', () => {
    expect(sessionsToEvict(sessions, 6)).toEqual([]);
    // 3 sessions, cap 4 -> nayi ke baad 4, bilkul cap par.
    expect(sessionsToEvict(sessions, 4)).toEqual([]);
  });

  it('cap bhar chuka ho to sabse purani jaati hai', () => {
    // cap 3: nayi ke liye 2 purani rakhni hain, to sabse purani (a) jayegi.
    expect(sessionsToEvict(sessions, 3)).toEqual(['a']);
  });

  it('bahut sessions hon to utni hi hattengi jitni zaroorat hai', () => {
    // cap 2: sirf 1 purani rakhni hai, to a aur b dono jayengi.
    expect(sessionsToEvict(sessions, 2)).toEqual(['a', 'b']);
  });

  it('cap 1 ho to nayi login ke liye saari purani jaati hain', () => {
    expect(sessionsToEvict(sessions, 1).sort()).toEqual(['a', 'b', 'c']);
  });

  it('khali list par kuch nahi hatta', () => {
    expect(sessionsToEvict([], 3)).toEqual([]);
  });

  it('string dates bhi chalti hain (prisma JSON se aayen to)', () => {
    const raw = [
      { id: 'new', createdAt: '2026-09-19T12:00:00Z' },
      { id: 'old', createdAt: '2026-09-19T09:00:00Z' },
    ];
    expect(sessionsToEvict(raw, 2)).toEqual(['old']);
  });
});

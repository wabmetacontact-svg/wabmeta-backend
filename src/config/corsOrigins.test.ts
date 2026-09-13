// Ye poore codebase ka sabse nazuk faisla hai. Cookies SameSite=none par hain
// aur CORS credentials: true hai, to yahan ka galat "haan" iska matlab hai ki
// wo page logged-in user ke cookies ke saath API padh sakta hai.
//
// Pehle yahan `origin.endsWith('.vercel.app')` tha - duniya ka koi bhi Vercel
// page allowed tha. Ye tests us haalat me wapas jaane se rokte hain.

import { describe, it, expect, vi, afterEach } from 'vitest';
import { buildVercelPattern, parseVercelPattern, isAllowedOrigin } from './corsOrigins';

const policy = (over: Partial<Parameters<typeof isAllowedOrigin>[1]> = {}) => ({
  allowed: ['https://wabmeta.com'],
  vercelPattern: null,
  isDevelopment: false,
  ...over,
});

afterEach(() => vi.restoreAllMocks());

describe('buildVercelPattern', () => {
  const p = buildVercelPattern('wabmeta', 'sameer-team')!;

  it('apne project + team ka preview allow karta hai', () => {
    expect(p.test('https://wabmeta-a1b2c3d4-sameer-team.vercel.app')).toBe(true);
  });

  it('dusre team ka same-naam project allow nahi karta', () => {
    expect(p.test('https://wabmeta-a1b2c3d4-attacker.vercel.app')).toBe(false);
  });

  it('prefix milta-julta ho to bhi nahi - yahi purana hole tha', () => {
    expect(p.test('https://evil-wabmeta-x-sameer-team.vercel.app')).toBe(false);
    expect(p.test('https://wabmeta.evil.com')).toBe(false);
    expect(p.test('https://notwabmeta-x-sameer-team.vercel.app')).toBe(false);
  });

  it('dot literal hai, koi bhi character nahi', () => {
    // Agar regex me \. ke bajay . hota, to ye pass ho jata.
    expect(p.test('https://wabmeta-abc-sameer-team.vercelXapp')).toBe(false);
    expect(p.test('https://wabmeta-abc-sameer-teamXvercel.app')).toBe(false);
  });

  it('suffix jodne se match nahi hota - pattern anchored hai', () => {
    expect(p.test('https://wabmeta-abc-sameer-team.vercel.app.evil.com')).toBe(false);
  });

  it('team na ho to koi pattern nahi - project akela kaafi nahi', () => {
    expect(buildVercelPattern('wabmeta', '')).toBeNull();
    expect(buildVercelPattern('', 'team')).toBeNull();
  });
});

describe('parseVercelPattern', () => {
  it('anchored pattern accept karta hai', () => {
    const r = parseVercelPattern('^https://x-[a-z0-9]+-t\\.vercel\\.app$');
    expect(r).not.toBeNull();
    expect(r!.test('https://x-abc-t.vercel.app')).toBe(true);
  });

  it('bina anchor ka pattern reject - warna wo kahin bhi match karega', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(parseVercelPattern('wabmeta-.*\\.vercel\\.app')).toBeNull();
    expect(parseVercelPattern('^https://x\\.vercel\\.app')).toBeNull(); // end anchor nahi
    expect(parseVercelPattern('https://x\\.vercel\\.app$')).toBeNull(); // start anchor nahi
    expect(spy).toHaveBeenCalled();
  });

  it('galat regex reject karta hai, throw nahi', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(parseVercelPattern('^([unclosed$')).toBeNull();
  });

  it('khali ya missing par null', () => {
    expect(parseVercelPattern('')).toBeNull();
    expect(parseVercelPattern(undefined)).toBeNull();
  });
});

describe('isAllowedOrigin', () => {
  it('allowlist wala origin allowed', () => {
    expect(isAllowedOrigin('https://wabmeta.com', policy())).toBe(true);
  });

  it('anjaan origin blocked', () => {
    expect(isAllowedOrigin('https://evil.com', policy())).toBe(false);
  });

  it('koi bhi vercel.app apne aap allowed NAHI hai', () => {
    expect(isAllowedOrigin('https://anything.vercel.app', policy())).toBe(false);
    expect(isAllowedOrigin('https://wabmeta-x-other.vercel.app', policy())).toBe(false);
  });

  it('pattern set ho to sirf wahi previews', () => {
    const pol = policy({ vercelPattern: buildVercelPattern('wabmeta', 'sameer-team') });
    expect(isAllowedOrigin('https://wabmeta-abc-sameer-team.vercel.app', pol)).toBe(true);
    expect(isAllowedOrigin('https://wabmeta-abc-attacker.vercel.app', pol)).toBe(false);
  });

  it('origin header na ho to allowed - mobile app, curl, server-to-server', () => {
    // Browser hamesha Origin bhejta hai, to ye cross-site attack ka rasta nahi.
    expect(isAllowedOrigin(undefined, policy())).toBe(true);
  });

  it('development me sab allowed', () => {
    expect(isAllowedOrigin('https://evil.com', policy({ isDevelopment: true }))).toBe(true);
  });
});

// JWT_SECRET pehle 'your-secret-key-change-in-production' par fall back karta
// tha, aur koi startup check nahi tha - env me naam galat hua to server chup-
// chaap us public string se tokens sign karta aur koi bhi admin token bana
// leta. Ye test us fallback ko wapas aane se rokta hai.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { checkJwtSecrets, MIN_JWT_SECRET_LENGTH } from './index';

const strong = (c: string) => c.repeat(MIN_JWT_SECRET_LENGTH + 16);

const input = (over: Partial<Parameters<typeof checkJwtSecrets>[0]> = {}) => ({
  secret: strong('a'),
  accessSecret: strong('b'),
  refreshSecret: strong('c'),
  accessExplicit: true,
  refreshExplicit: true,
  ...over,
});

describe('checkJwtSecrets', () => {
  it('teeno alag aur lambe hon to ok, koi problem nahi', () => {
    const r = checkJwtSecrets(input());
    expect(r.ok).toBe(true);
    expect(r.problems).toEqual([]);
  });

  it('secret missing ho to production start nahi hona chahiye', () => {
    const r = checkJwtSecrets(input({ secret: '', accessSecret: '', refreshSecret: '' }));
    expect(r.ok).toBe(false);
    expect(r.problems.join(' ')).toContain('JWT_SECRET is not set');
  });

  it('chhota secret bhi fail - ek token se offline brute force ho jata hai', () => {
    const r = checkJwtSecrets(input({ secret: 'short', accessSecret: 'short', refreshSecret: 'short' }));
    expect(r.ok).toBe(false);
    expect(r.problems.join(' ')).toContain(`need at least ${MIN_JWT_SECRET_LENGTH}`);
  });

  // Asli suraksha lambai nahi, fallback ka na hona hai: koi bhi default value
  // repo me likhi hoti hai, yaani public hoti hai. Isliye source par assert.
  it('config me koi hardcoded JWT fallback nahi hai', () => {
    const source = readFileSync(new URL('./index.ts', import.meta.url), 'utf-8');
    const jwtBlock = source
      .slice(source.indexOf('jwt: {'), source.indexOf('encryption: {'))
      // Comments nikaal do - wo defaults ko naam se samjhate hain, use karte nahi.
      .split('\n')
      .filter((line) => !line.trim().startsWith('//'))
      .join('\n');

    expect(jwtBlock).not.toContain('your-secret-key-change-in-production');
    expect(jwtBlock).not.toContain("'access-secret'");
    expect(jwtBlock).not.toContain("'refresh-secret'");
    // getEnv('JWT_SECRET') - doosra argument (default) hona hi nahi chahiye.
    expect(jwtBlock).toMatch(/getEnv\('JWT_SECRET'\)/);
  });

  it('ek hi JWT_SECRET se dono banen to start hota hai, par warning ke saath', () => {
    const shared = strong('a');
    const r = checkJwtSecrets({
      secret: shared,
      accessSecret: shared,
      refreshSecret: shared,
      accessExplicit: false,
      refreshExplicit: false,
    });
    expect(r.ok).toBe(true);
    expect(r.problems.join(' ')).toContain('set them separately');
  });

  it('explicitly alag set hon to warning nahi', () => {
    const r = checkJwtSecrets(input({ accessExplicit: true, refreshExplicit: true }));
    expect(r.problems).toEqual([]);
  });
});

// axios 1.20 ke baad har media download isi helper se guzarta hai - galat hua
// to Content-Type "undefined" ya "[object Object]" ban kar client tak jayega.

import { describe, it, expect } from 'vitest';
import { headerString, mimeFromHeader } from './httpHeaders';

describe('headerString', () => {
  it('string waisi hi lautati hai', () => {
    expect(headerString('image/png')).toBe('image/png');
  });

  it('array se pehli value leti hai', () => {
    expect(headerString(['image/png', 'image/jpeg'])).toBe('image/png');
  });

  it('missing, boolean aur khali par fallback', () => {
    expect(headerString(undefined, 'image/jpeg')).toBe('image/jpeg');
    expect(headerString(null, 'image/jpeg')).toBe('image/jpeg');
    expect(headerString(true, 'image/jpeg')).toBe('image/jpeg');
    expect(headerString('', 'image/jpeg')).toBe('image/jpeg');
  });

  it('number ko string banati hai', () => {
    expect(headerString(1234)).toBe('1234');
  });
});

describe('mimeFromHeader', () => {
  it('charset aur baaki parameters hatati hai', () => {
    expect(mimeFromHeader('text/html; charset=utf-8')).toBe('text/html');
    expect(mimeFromHeader('  image/png  ')).toBe('image/png');
  });

  it('missing par fallback', () => {
    expect(mimeFromHeader(undefined, 'image/jpeg')).toBe('image/jpeg');
    expect(mimeFromHeader(true, 'image/jpeg')).toBe('image/jpeg');
  });
});

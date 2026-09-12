// Lead kis message par bane - ye filter hi poore feature ka gate hai, isliye
// alag se test. Pure function hai, koi DB nahi.

import { describe, it, expect } from 'vitest';
import { isQualifyingSocialText } from './crm.social';

describe('isQualifyingSocialText', () => {
  it('asli sawaal par lead banta hai', () => {
    expect(isQualifyingSocialText('kitne ka padega website banana?')).toBe(true);
    expect(isQualifyingSocialText('Do you deliver to Pune')).toBe(true);
    expect(isQualifyingSocialText('price?')).toBe(true);
  });

  it('Telegram command par lead nahi banta', () => {
    expect(isQualifyingSocialText('/start')).toBe(false);
    expect(isQualifyingSocialText('/help')).toBe(false);
    expect(isQualifyingSocialText('  /start  ')).toBe(false);
  });

  it('akela greeting par lead nahi banta', () => {
    for (const g of ['hi', 'Hi', 'HELLO', 'hii!!!', 'namaste', 'ok', 'thanks', 'good morning']) {
      expect(isQualifyingSocialText(g), g).toBe(false);
    }
  });

  it('greeting ke saath asli baat ho to lead banta hai', () => {
    expect(isQualifyingSocialText('hi, price kya hai')).toBe(true);
    expect(isQualifyingSocialText('hello I need a demo')).toBe(true);
  });

  it('khali, chhota aur missing text par lead nahi banta', () => {
    expect(isQualifyingSocialText('')).toBe(false);
    expect(isQualifyingSocialText('   ')).toBe(false);
    expect(isQualifyingSocialText('k')).toBe(false);
    expect(isQualifyingSocialText(null)).toBe(false);
    expect(isQualifyingSocialText(undefined)).toBe(false);
  });
});

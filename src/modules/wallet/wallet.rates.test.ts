// These rates are real money - this is what comes out of a customer's wallet
// and what we owe Meta. If they drift quietly we either lose money on every
// send or overcharge the customer. India's rates are set against competitors,
// so they are pinned here.

import { describe, it, expect } from 'vitest';
import {
  COUNTRY_RATES,
  DEFAULT_RATE,
  getCountryRateFromPhone,
  getRateForCategory,
  matchCountryPrefix,
  rateCard,
  resolveRates,
} from './wallet.deduction.service';

describe('India rates', () => {
  it('match or beat AiSensy', () => {
    const india = COUNTRY_RATES['91'];
    // AiSensy: marketing 1.09, utility 0.145, authentication 0.145
    expect(india.marketing).toBeLessThanOrEqual(1.09);
    expect(india.utility).toBeLessThanOrEqual(0.145);
    expect(india.authentication).toBeLessThanOrEqual(0.145);
  });

  it('utility sits at 0.145 - it was 0.19, and it is the biggest volume', () => {
    expect(COUNTRY_RATES['91'].utility).toBe(0.145);
  });

  it('an Indian number is charged that rate', () => {
    const r = getCountryRateFromPhone('+919812345678');
    expect(r.utility).toBe(0.145);
    expect(getRateForCategory('UTILITY', '+919812345678')).toBe(0.145);
  });
});

describe('DEFAULT_RATE', () => {
  it('is never below India - undercharging an unknown country is a straight loss', () => {
    const india = COUNTRY_RATES['91'];
    expect(DEFAULT_RATE.marketing).toBeGreaterThanOrEqual(india.marketing);
    expect(DEFAULT_RATE.utility).toBeGreaterThanOrEqual(india.utility);
    expect(DEFAULT_RATE.authentication).toBeGreaterThanOrEqual(india.authentication);
  });
});

describe('which country pays', () => {
  // Meta bills on the recipient's country. The template's language is a guess
  // about it, and a bad one: the language table maps plain 'en' to India.
  it('the recipient number wins over the template language', () => {
    const uk = COUNTRY_RATES['44'];
    expect(resolveRates('+447700900123', 'en')).toEqual(uk);
    expect(getRateForCategory('MARKETING', '+447700900123', 'en')).toBe(uk.marketing);
  });

  it('a Hindi template to a US number is charged US rates', () => {
    const usa = COUNTRY_RATES['1'];
    expect(getRateForCategory('MARKETING', '+14155550123', 'hi')).toBe(usa.marketing);
  });

  it('the language is used only when the number tells us nothing', () => {
    expect(resolveRates(undefined, 'hi')).toEqual(COUNTRY_RATES['91']);
    expect(resolveRates('', 'de')).toEqual(COUNTRY_RATES['49']);
    // A number whose prefix we do not recognise is no better than no number.
    expect(resolveRates('+999000111', 'de')).toEqual(COUNTRY_RATES['49']);
  });

  it('falls back to DEFAULT_RATE when there is neither', () => {
    expect(resolveRates()).toEqual(DEFAULT_RATE);
    expect(resolveRates('+999000111', 'klingon')).toEqual(DEFAULT_RATE);
  });

  it('an unknown category is charged as marketing - the dearest, never the cheapest', () => {
    const india = COUNTRY_RATES['91'];
    expect(getRateForCategory('SOMETHING_NEW', '+919812345678')).toBe(india.marketing);
  });
});

describe('matchCountryPrefix', () => {
  it('takes the longest match, so +1809 is not read as +1', () => {
    expect(matchCountryPrefix('+18095550123')).toBe('1809');
    expect(matchCountryPrefix('+14155550123')).toBe('1');
  });

  it('copes with spacing, zeros and rubbish', () => {
    expect(matchCountryPrefix('0091 98123 45678')).toBe('91');
    expect(matchCountryPrefix('')).toBeNull();
    expect(matchCountryPrefix('+999000111')).toBeNull();
  });
});

describe('rateCard', () => {
  it('quotes exactly what the wallet charges', () => {
    const india = rateCard().find((c) => c.code === '91')!;
    expect(india.utility).toBe(COUNTRY_RATES['91'].utility);
    expect(india.marketing).toBe(COUNTRY_RATES['91'].marketing);
    expect(india.authentication).toBe(COUNTRY_RATES['91'].authentication);
  });

  it('shows service conversations as free', () => {
    expect(rateCard().every((c) => c.service === 0)).toBe(true);
  });

  it('never lists a country it cannot price', () => {
    for (const c of rateCard()) {
      expect(COUNTRY_RATES[c.code], `${c.name} (${c.code})`).toBeDefined();
      expect(c.name.length).toBeGreaterThan(0);
    }
  });
});

// Ye rates asli paisa hain - client ke wallet se yahi kata jaata hai. Chup-chaap
// badal jayen to ya to hum nuksan me jate hain, ya client ko zyada charge hota
// hai. India ke rates competitors ke saamne rakhe gaye hain, isliye locked.

import { describe, it, expect } from 'vitest';
import { COUNTRY_RATES, DEFAULT_RATE, getCountryRateFromPhone, getRateForCategory } from './wallet.deduction.service';

describe('India rates', () => {
  it('AiSensy ke barabar ya usse behtar hain', () => {
    const india = COUNTRY_RATES['91'];
    // AiSensy: marketing 1.09, utility 0.145, authentication 0.145
    expect(india.marketing).toBeLessThanOrEqual(1.09);
    expect(india.utility).toBeLessThanOrEqual(0.145);
    expect(india.authentication).toBeLessThanOrEqual(0.145);
  });

  it('utility 0.145 par hai - pehle 0.19 tha aur wahi sabse bada volume hai', () => {
    expect(COUNTRY_RATES['91'].utility).toBe(0.145);
  });

  it('Indian number par wahi rate lagta hai', () => {
    const r = getCountryRateFromPhone('+919812345678');
    expect(r.utility).toBe(0.145);
    expect(getRateForCategory('UTILITY', '+919812345678')).toBe(0.145);
  });
});

describe('DEFAULT_RATE', () => {
  it('India se kam nahi hai - anjaan country par kam charge karna seedha nuksan hai', () => {
    const india = COUNTRY_RATES['91'];
    expect(DEFAULT_RATE.marketing).toBeGreaterThanOrEqual(india.marketing);
    expect(DEFAULT_RATE.utility).toBeGreaterThanOrEqual(india.utility);
    expect(DEFAULT_RATE.authentication).toBeGreaterThanOrEqual(india.authentication);
  });
});

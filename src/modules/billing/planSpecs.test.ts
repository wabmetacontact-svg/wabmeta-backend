// Ye array asli pricing banata hai - jo yahan likha hai wahi DB me jaata hai
// aur wahi client se charge hota hai. Sabse zaroori check aakhri wala hai:
// includedFeatures ki keys featureLock ke naamon se match karti hain ya nahi.
// Ek typo (crm ki jagah crmPipelines) chup-chaap feature band rakhega aur
// koi error kahin nahi aayega.

import { describe, it, expect } from 'vitest';
import { PLANS } from '../../../prisma/set-billing-plans';
import { LOCKABLE_FEATURES } from '../../middleware/featureLock';

const byType = (t: string) => PLANS.find((p) => p.type === t)!;

describe('naye tiers', () => {
  it('chaaron maujood hain, tay kiye gaye daamon par', () => {
    expect(byType('STARTER').price).toBe(799);
    expect(byType('GROWTH').price).toBe(1799);
    expect(byType('PRO').price).toBe(2999);
    expect(byType('BUSINESS').price).toBe(5999);
  });

  it('annual = 10 mahine ka daam (2 mahine free)', () => {
    for (const t of ['STARTER', 'GROWTH', 'PRO', 'BUSINESS']) {
      const p = byType(t);
      expect(p.yearlyPrice).toBe(p.price * 10);
    }
  });

  it('daam upar ki taraf badhte hain', () => {
    const prices = ['STARTER', 'GROWTH', 'PRO', 'BUSINESS'].map((t) => byType(t).price);
    for (let i = 1; i < prices.length; i++) {
      expect(prices[i]).toBeGreaterThan(prices[i - 1]);
    }
  });

  it('sirf Growth par "most popular" badge hai', () => {
    const recommended = PLANS.filter((p) => p.isRecommended).map((p) => p.type);
    expect(recommended).toEqual(['GROWTH']);
  });
});

describe('channels aur features', () => {
  it('Starter: Instagram haan, Telegram nahi', () => {
    const f = byType('STARTER').includedFeatures!;
    expect(f.instagram).toBe(true);
    expect(f.telegram).toBe(false);
  });

  it('Starter me automation, CRM aur AI nahi', () => {
    const f = byType('STARTER').includedFeatures!;
    expect(f.chatbot).toBe(false);
    expect(f.automation).toBe(false);
    expect(f.crm).toBe(false);
    expect(f.reports).toBe(false);
    expect(f.aiAgent).toBe(false);
  });

  it('Growth me Telegram, automation aur CRM hain par AI nahi', () => {
    const f = byType('GROWTH').includedFeatures!;
    expect(f.telegram).toBe(true);
    expect(f.chatbot).toBe(true);
    expect(f.automation).toBe(true);
    expect(f.crm).toBe(true);
    expect(f.aiAgent).toBe(false);
  });

  it('AI sirf Pro aur Business me', () => {
    expect(byType('PRO').includedFeatures!.aiAgent).toBe(true);
    expect(byType('BUSINESS').includedFeatures!.aiAgent).toBe(true);
  });

  it('upar wale tier me neeche wale ka har feature hota hai', () => {
    const order = ['STARTER', 'GROWTH', 'PRO', 'BUSINESS'];
    for (let i = 1; i < order.length; i++) {
      const lower = byType(order[i - 1]).includedFeatures!;
      const upper = byType(order[i]).includedFeatures!;
      for (const [k, on] of Object.entries(lower)) {
        if (on) expect(upper[k], `${order[i]} me ${k}`).toBe(true);
      }
    }
  });
});

describe('includedFeatures ki keys', () => {
  it('sirf asli feature naam - typo chup-chaap feature band kar deta hai', () => {
    for (const p of PLANS) {
      for (const key of Object.keys(p.includedFeatures ?? {})) {
        expect(LOCKABLE_FEATURES, `${p.type} me "${key}"`).toContain(key);
      }
    }
  });

  it('naye tiers har feature ke baare me saaf bolte hain', () => {
    for (const t of ['STARTER', 'GROWTH', 'PRO', 'BUSINESS']) {
      const f = byType(t).includedFeatures!;
      for (const feature of LOCKABLE_FEATURES) {
        expect(typeof f[feature], `${t} me ${feature}`).toBe('boolean');
      }
    }
  });
});

describe('purane plans', () => {
  it('pricing page par nahi dikhte, par zinda hain', () => {
    for (const t of ['MONTHLY', 'QUARTERLY', 'BIANNUAL', 'ANNUAL']) {
      expect(byType(t).isPublic).toBe(false);
    }
  });

  it('naye tiers aur Free Demo dikhte hain', () => {
    for (const t of ['FREE_DEMO', 'STARTER', 'GROWTH', 'PRO', 'BUSINESS']) {
      expect(byType(t).isPublic ?? true).toBe(true);
    }
  });
});

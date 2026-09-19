// This array is the real pricing: what is written here goes into the database
// and is what the customer gets charged. The check that matters most is the
// last one - that every key in includedFeatures is a name something actually
// reads. A typo (crmPipelines instead of crm) silently leaves a paid feature
// switched off and raises no error anywhere.

import { describe, it, expect } from 'vitest';
import { PLANS } from '../../../prisma/set-billing-plans';
import { LOCKABLE_FEATURES, VALID_PLAN_FLAGS } from '../../middleware/featureLock';

const byType = (t: string) => PLANS.find((p) => p.type === t)!;

const PAID_TIERS = ['STARTER', 'GROWTH', 'PRO', 'BUSINESS'];

describe('the new tiers', () => {
  it('all four exist, at the agreed prices', () => {
    expect(byType('STARTER').price).toBe(799);
    expect(byType('GROWTH').price).toBe(1799);
    expect(byType('PRO').price).toBe(2999);
    expect(byType('BUSINESS').price).toBe(5999);
  });

  it('annual costs ten months (two months free)', () => {
    for (const t of PAID_TIERS) {
      const p = byType(t);
      expect(p.yearlyPrice).toBe(p.price * 10);
    }
  });

  it('prices only go up as the ladder goes up', () => {
    const prices = PAID_TIERS.map((t) => byType(t).price);
    for (let i = 1; i < prices.length; i++) {
      expect(prices[i]).toBeGreaterThan(prices[i - 1]);
    }
  });

  it('only Growth wears the "most popular" badge', () => {
    const recommended = PLANS.filter((p) => p.isRecommended).map((p) => p.type);
    expect(recommended).toEqual(['GROWTH']);
  });
});

describe('channels and features', () => {
  it('Starter: Instagram yes, Telegram no', () => {
    const f = byType('STARTER').includedFeatures!;
    expect(f.instagram).toBe(true);
    expect(f.telegram).toBe(false);
  });

  it('Starter has no automation, CRM or AI', () => {
    const f = byType('STARTER').includedFeatures!;
    expect(f.chatbot).toBe(false);
    expect(f.automation).toBe(false);
    expect(f.crm).toBe(false);
    expect(f.reports).toBe(false);
    expect(f.aiAgent).toBe(false);
  });

  it('Growth has Telegram, automation and CRM, but not AI', () => {
    const f = byType('GROWTH').includedFeatures!;
    expect(f.telegram).toBe(true);
    expect(f.chatbot).toBe(true);
    expect(f.automation).toBe(true);
    expect(f.crm).toBe(true);
    expect(f.aiAgent).toBe(false);
  });

  it('AI is Pro and Business only', () => {
    expect(byType('PRO').includedFeatures!.aiAgent).toBe(true);
    expect(byType('BUSINESS').includedFeatures!.aiAgent).toBe(true);
  });

  it('bulk paste is in every plan except Starter', () => {
    // The one feature Starter gives up that is not a channel - if this flips,
    // Starter silently becomes as good as Growth for bulk importers.
    expect(byType('STARTER').includedFeatures!.bulkPaste).toBe(false);
    for (const t of ['FREE_DEMO', 'GROWTH', 'PRO', 'BUSINESS']) {
      expect(byType(t).includedFeatures!.bulkPaste, `${t} bulkPaste`).toBe(true);
    }
  });

  it('every tier includes everything the tier below it includes', () => {
    for (let i = 1; i < PAID_TIERS.length; i++) {
      const lower = byType(PAID_TIERS[i - 1]).includedFeatures!;
      const upper = byType(PAID_TIERS[i]).includedFeatures!;
      for (const [k, on] of Object.entries(lower)) {
        if (on) expect(upper[k], `${PAID_TIERS[i]} ${k}`).toBe(true);
      }
    }
  });
});

describe('usage caps', () => {
  it('paid tiers raise the caps as the price goes up', () => {
    const contacts = PAID_TIERS.map((t) => byType(t).caps?.maxContacts ?? 999999);
    const messages = PAID_TIERS.map((t) => byType(t).caps?.maxMessages ?? 999999);

    for (let i = 1; i < PAID_TIERS.length; i++) {
      expect(contacts[i], `${PAID_TIERS[i]} contacts`).toBeGreaterThan(contacts[i - 1]);
      expect(messages[i], `${PAID_TIERS[i]} messages`).toBeGreaterThan(messages[i - 1]);
    }
  });

  it('Starter is capped at the advertised 5,000 contacts and 10,000 messages', () => {
    const caps = byType('STARTER').caps!;
    expect(caps.maxContacts).toBe(5000);
    expect(caps.maxMessages).toBe(10000);
  });

  it('no cap on a current plan is zero - zero means "locked", not "small"', () => {
    // featureLock reads a 0 limit as "this plan does not include the feature",
    // so a cap of 0 would switch the feature off instead of limiting it.
    // The retired MONTHLY plan does carry deliberate zeroes; it is excluded.
    for (const p of PLANS.filter((x) => ['FREE_DEMO', ...PAID_TIERS].includes(x.type))) {
      for (const [k, v] of Object.entries(p.caps ?? {})) {
        expect(v, `${p.type} ${k}`).toBeGreaterThan(0);
      }
    }
  });
});

describe('includedFeatures keys', () => {
  it('only names something actually reads - a typo silently disables a feature', () => {
    for (const p of PLANS) {
      for (const key of Object.keys(p.includedFeatures ?? {})) {
        expect(VALID_PLAN_FLAGS, `${p.type} has "${key}"`).toContain(key);
      }
    }
  });

  it('the new tiers state every lockable feature explicitly', () => {
    for (const t of PAID_TIERS) {
      const f = byType(t).includedFeatures!;
      for (const feature of LOCKABLE_FEATURES) {
        expect(typeof f[feature], `${t} ${feature}`).toBe('boolean');
      }
    }
  });
});

describe('the retired duration plans', () => {
  it('are off the pricing page but still alive', () => {
    for (const t of ['MONTHLY', 'QUARTERLY', 'BIANNUAL', 'ANNUAL']) {
      expect(byType(t).isPublic).toBe(false);
    }
  });

  it('the new tiers and Free Demo are on it', () => {
    for (const t of ['FREE_DEMO', ...PAID_TIERS]) {
      expect(byType(t).isPublic ?? true).toBe(true);
    }
  });
});

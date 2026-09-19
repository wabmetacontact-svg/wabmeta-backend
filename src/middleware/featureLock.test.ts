// Ye logic har feature-gated route ke aage chalta hai. Galti do tarah se
// mehengi hai: ya to paid feature muft me khul jayega, ya poore customers ka
// access bina wajah band ho jayega.
//
// Sabse zaroori test wahi hai jo kehta hai "purane plans par kuch nahi badla" -
// includedFeatures aane se pehle ke plans waise ke waise chalne chahiye.

import { describe, it, expect } from 'vitest';
import {
  computeFeatureLocks,
  planExcludesFeature,
  LOCKABLE_FEATURES,
  FEATURE_REGISTRY,
} from './featureLock';

/** Org object jaisa prisma se aata hai. */
const org = (over: Record<string, any> = {}, plan: any = undefined) => ({
  id: 'org1',
  ...LOCKABLE_FEATURES.reduce((acc, f) => {
    acc[FEATURE_REGISTRY[f].column] = false;
    return acc;
  }, {} as Record<string, boolean>),
  ...over,
  subscription: plan === undefined ? undefined : { plan },
});

describe('planExcludesFeature', () => {
  it('plan hi na ho to kuch lock nahi - warna plan data missing hone par sab band', () => {
    for (const f of LOCKABLE_FEATURES) {
      expect(planExcludesFeature(null, f)).toBe(false);
      expect(planExcludesFeature(undefined, f)).toBe(false);
    }
  });

  it('includedFeatures me false likha ho to feature band', () => {
    const plan = { includedFeatures: { telegram: false, crm: false } };
    expect(planExcludesFeature(plan, 'telegram')).toBe(true);
    expect(planExcludesFeature(plan, 'crm')).toBe(true);
  });

  it('includedFeatures me true likha ho to khula', () => {
    const plan = { includedFeatures: { telegram: true } };
    expect(planExcludesFeature(plan, 'telegram')).toBe(false);
  });

  it('includedFeatures numeric limit ko overrule karta hai', () => {
    // Plan kehta hai chatbot milta hai, par purani limit 0 padi hai.
    const plan = { includedFeatures: { chatbot: true }, maxChatbots: 0 };
    expect(planExcludesFeature(plan, 'chatbot')).toBe(false);

    // Ulta case: limit theek hai par plan saaf mana kar raha hai.
    const plan2 = { includedFeatures: { chatbot: false }, maxChatbots: 5 };
    expect(planExcludesFeature(plan2, 'chatbot')).toBe(true);
  });

  it('includedFeatures na ho to purani numeric limit chalti hai', () => {
    expect(planExcludesFeature({ maxChatbots: 0 }, 'chatbot')).toBe(true);
    expect(planExcludesFeature({ maxChatbots: 2 }, 'chatbot')).toBe(false);
    expect(planExcludesFeature({ maxAutomations: 0 }, 'automation')).toBe(true);
    expect(planExcludesFeature({ maxWhatsAppAccounts: 0 }, 'connection')).toBe(true);
  });

  it('jis feature ki na flag hai na limit, wo khula rehta hai', () => {
    // crm ke paas koi numeric limit hai hi nahi - pehle ye plan se lock ho
    // hi nahi sakta tha.
    expect(planExcludesFeature({ maxChatbots: 0 }, 'crm')).toBe(false);
    expect(planExcludesFeature({}, 'reports')).toBe(false);
  });

  it('includedFeatures kachra ho to crash nahi, lock bhi nahi', () => {
    expect(planExcludesFeature({ includedFeatures: null }, 'crm')).toBe(false);
    expect(planExcludesFeature({ includedFeatures: 'nonsense' }, 'crm')).toBe(false);
    expect(planExcludesFeature({ includedFeatures: [] }, 'crm')).toBe(false);
  });
});

describe('computeFeatureLocks', () => {
  it('kuch set na ho to sab khula', () => {
    const locks = computeFeatureLocks(org());
    for (const f of LOCKABLE_FEATURES) expect(locks[f]).toBe(false);
  });

  it('admin ka lock akela hi kaafi hai', () => {
    const locks = computeFeatureLocks(org({ featureCrmLocked: true }));
    expect(locks.crm).toBe(true);
    expect(locks.inbox).toBe(false);
  });

  it('plan ka lock akela hi kaafi hai', () => {
    const locks = computeFeatureLocks(
      org({}, { includedFeatures: { telegram: false } })
    );
    expect(locks.telegram).toBe(true);
    expect(locks.instagram).toBe(false);
  });

  it('admin ka unlock plan ko nahi harata (aaj ka behaviour)', () => {
    // featureTelegramLocked false hai, par plan me Telegram hai hi nahi.
    const locks = computeFeatureLocks(
      org({ featureTelegramLocked: false }, { includedFeatures: { telegram: false } })
    );
    expect(locks.telegram).toBe(true);
  });

  it('Starter jaisa plan: Telegram band, Instagram khula', () => {
    const starter = {
      includedFeatures: {
        inbox: true, contacts: true, templates: true, campaigns: true,
        instagram: true, telegram: false,
        chatbot: false, automation: false, crm: false, reports: false,
        aiAgent: false, wallet: true, connection: true,
      },
    };
    const locks = computeFeatureLocks(org({}, starter));
    expect(locks.instagram).toBe(false);
    expect(locks.telegram).toBe(true);
    expect(locks.crm).toBe(true);
    expect(locks.aiAgent).toBe(true);
    expect(locks.inbox).toBe(false);
    expect(locks.wallet).toBe(false);
  });

  it('purane plan par kuch nahi badla - yahi is change ki sabse badi shart hai', () => {
    // Aaj ka MONTHLY plan: koi includedFeatures nahi, sirf numeric limits.
    const legacyMonthly = {
      maxCampaigns: 999999,
      maxChatbots: 0,
      maxAutomations: 0,
      maxWhatsAppAccounts: 1,
    };
    const locks = computeFeatureLocks(org({}, legacyMonthly));

    expect(locks.chatbot).toBe(true);
    expect(locks.automation).toBe(true);
    expect(locks.aiAgent).toBe(true); // aiAgent ki planLimit maxChatbots hai
    expect(locks.campaigns).toBe(false);
    expect(locks.connection).toBe(false);
    // Jin par plan ka koi zor nahi tha, wo aaj bhi khule hain.
    expect(locks.crm).toBe(false);
    expect(locks.reports).toBe(false);
    expect(locks.telegram).toBe(false);
    expect(locks.instagram).toBe(false);
  });
});

describe('admin override', () => {
  const starterPlan = { includedFeatures: { telegram: false, crm: false } };

  it('override plan ke lock ko harata hai', () => {
    const locks = computeFeatureLocks(
      org({ featureOverrides: { telegram: true } }, starterPlan)
    );
    expect(locks.telegram).toBe(false);
    // Jo override nahi kiya wo band hi rehta hai.
    expect(locks.crm).toBe(true);
  });

  it('admin ka lock override se upar hai - "band karo" hamesha chalta hai', () => {
    const locks = computeFeatureLocks(
      org({ featureTelegramLocked: true, featureOverrides: { telegram: true } }, starterPlan)
    );
    expect(locks.telegram).toBe(true);
  });

  it('plan me feature ho to override se kuch farak nahi padta', () => {
    const locks = computeFeatureLocks(
      org({ featureOverrides: { telegram: true } }, { includedFeatures: { telegram: true } })
    );
    expect(locks.telegram).toBe(false);
  });

  it('sirf true maayne rakhta hai - false likhne se feature khulta nahi', () => {
    const locks = computeFeatureLocks(
      org({ featureOverrides: { telegram: false } }, starterPlan)
    );
    expect(locks.telegram).toBe(true);
  });

  it('kachra override crash nahi karta aur kuch kholta bhi nahi', () => {
    for (const bad of [null, 'yes', [], 42, { telegram: 'true' }]) {
      const locks = computeFeatureLocks(org({ featureOverrides: bad }, starterPlan));
      expect(locks.telegram).toBe(true);
    }
  });

  it('purane orgs par override column khali hai - kuch nahi badla', () => {
    const locks = computeFeatureLocks(org({}, starterPlan));
    expect(locks.telegram).toBe(true);
    expect(locks.crm).toBe(true);
  });
});

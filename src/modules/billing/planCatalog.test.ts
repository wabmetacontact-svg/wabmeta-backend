// Ye checkout ka daam tay karta hai. Galti seedha paise ki hai: kam charge
// karna nuksan, zyada charge karna refund aur bharosa dono ka nuksan, aur
// galat validityDays ka matlab client ko jitna paisa diya usse zyada ya kam
// access mil jana.

import { describe, it, expect } from 'vitest';
import { resolvePricing, subscriptionDays, PLAN_KEYS, type PricingRow } from './planCatalog';

const plan = (over: Partial<PricingRow> = {}): PricingRow => ({
  name: 'Starter',
  type: 'STARTER' as any,
  monthlyPrice: 799,
  yearlyPrice: 7990,
  validityDays: 30,
  isActive: true,
  ...over,
});

describe('resolvePricing', () => {
  it('monthly cycle: monthlyPrice, 30 din', () => {
    const r = resolvePricing(plan(), PLAN_KEYS.starter);
    expect(r.amount).toBe(79900);
    expect(r.validityDays).toBe(30);
    expect(r.planType).toBe('STARTER');
  });

  it('yearly cycle: yearlyPrice, 365 din', () => {
    const r = resolvePricing(plan(), PLAN_KEYS.starter_yearly);
    expect(r.amount).toBe(799000);
    expect(r.validityDays).toBe(365);
  });

  it('term cycle: plan ki apni validityDays (purane duration plans)', () => {
    const sixMonth = plan({
      name: '6-Month Plan',
      type: 'BIANNUAL' as any,
      monthlyPrice: 5000,
      validityDays: 180,
    });
    const r = resolvePricing(sixMonth, PLAN_KEYS['6-month']);
    expect(r.amount).toBe(500000);
    expect(r.validityDays).toBe(180);
  });

  it('Prisma Decimal string se bhi theek paise bante hain', () => {
    const r = resolvePricing(plan({ monthlyPrice: '2999.00' }), PLAN_KEYS.pro);
    expect(r.amount).toBe(299900);
  });

  it('paise hamesha poora number hote hain', () => {
    const r = resolvePricing(plan({ monthlyPrice: 799.994 }), PLAN_KEYS.starter);
    expect(Number.isInteger(r.amount)).toBe(true);
  });

  it('plan hi na mile to throw - chup-chaap kuch charge mat karo', () => {
    expect(() => resolvePricing(null, PLAN_KEYS.starter)).toThrow();
    expect(() => resolvePricing(undefined, PLAN_KEYS.starter)).toThrow();
  });

  it('band plan khareeda nahi ja sakta', () => {
    expect(() => resolvePricing(plan({ isActive: false }), PLAN_KEYS.starter)).toThrow();
  });

  it('daam 0 ya galat ho to throw - warna client ko muft me plan mil jata', () => {
    expect(() => resolvePricing(plan({ monthlyPrice: 0 }), PLAN_KEYS.starter)).toThrow();
    expect(() => resolvePricing(plan({ monthlyPrice: -1 }), PLAN_KEYS.starter)).toThrow();
    expect(() => resolvePricing(plan({ monthlyPrice: null }), PLAN_KEYS.starter)).toThrow();
    expect(() => resolvePricing(plan({ monthlyPrice: 'abc' }), PLAN_KEYS.starter)).toThrow();
    // yearly key par yearlyPrice hi dekha jata hai
    expect(() => resolvePricing(plan({ yearlyPrice: 0 }), PLAN_KEYS.starter_yearly)).toThrow();
  });

  it('term plan ki validity 0 ho to throw', () => {
    expect(() =>
      resolvePricing(plan({ validityDays: 0 }), PLAN_KEYS.monthly)
    ).toThrow();
  });

  it('label me cycle dikhta hai, taaki invoice par saaf rahe', () => {
    expect(resolvePricing(plan(), PLAN_KEYS.starter).label).toContain('monthly');
    expect(resolvePricing(plan(), PLAN_KEYS.starter_yearly).label).toContain('yearly');
    // purane term plans ka naam hi kaafi hai
    expect(resolvePricing(plan({ name: '6-Month Plan' }), PLAN_KEYS['6-month']).label)
      .toBe('6-Month Plan');
  });
});

describe('PLAN_KEYS', () => {
  it('purani keys zinda hain - maujooda checkout links tootne nahi chahiye', () => {
    for (const k of ['monthly', 'three_month', '3-month', 'six_month', '6-month', 'one_year', '1-year']) {
      expect(PLAN_KEYS[k]).toBeDefined();
      expect(PLAN_KEYS[k].cycle).toBe('term');
    }
  });

  it('har naye tier ka monthly aur yearly dono hai', () => {
    for (const t of ['starter', 'growth', 'pro', 'business']) {
      expect(PLAN_KEYS[t].cycle).toBe('monthly');
      expect(PLAN_KEYS[`${t}_yearly`].cycle).toBe('yearly');
      expect(PLAN_KEYS[t].type).toBe(PLAN_KEYS[`${t}_yearly`].type);
    }
  });
});

describe('subscriptionDays', () => {
  it('order ke notes sabse upar - client ne paisa usi ke hisaab se diya', () => {
    // Naye tier ka yearly purchase: plan ki validityDays 30 hai, par becha
    // 365 din gaya tha. Pehle yahi ulta tha aur saal ka paisa lekar ek
    // mahina milta tha.
    expect(subscriptionDays({ notesValidityDays: 365, planValidityDays: 30 })).toBe(365);
  });

  it('notes string me aayen to bhi chalta hai (Razorpay sab string bhejta hai)', () => {
    expect(subscriptionDays({ notesValidityDays: '365' })).toBe(365);
  });

  it('notes na hon to billingCycle se yearly pehchana jata hai', () => {
    expect(subscriptionDays({ billingCycle: 'yearly', planValidityDays: 30 })).toBe(365);
    expect(subscriptionDays({ billingCycle: 'YEARLY', planValidityDays: 30 })).toBe(365);
  });

  it('monthly cycle par plan ki validity chalti hai', () => {
    expect(subscriptionDays({ billingCycle: 'monthly', planValidityDays: 30 })).toBe(30);
  });

  it('purane term plans par plan ki apni validity', () => {
    expect(subscriptionDays({ planValidityDays: 180 })).toBe(180);
    expect(subscriptionDays({ planValidityDays: 90 })).toBe(90);
  });

  it('kuch bhi na mile to 30 - kabhi 0 din nahi', () => {
    expect(subscriptionDays({})).toBe(30);
    expect(subscriptionDays({ notesValidityDays: 0, planValidityDays: 0 })).toBe(30);
    expect(subscriptionDays({ notesValidityDays: 'abc' })).toBe(30);
    expect(subscriptionDays({ notesValidityDays: -5 })).toBe(30);
  });
});

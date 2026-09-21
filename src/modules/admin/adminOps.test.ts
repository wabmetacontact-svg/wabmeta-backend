// Pure rules behind coupons, tags, announcements and CSV export.

import { describe, it, expect } from 'vitest';
import { applyCoupon, couponProblem, isValidCouponCode, normalizeCouponCode } from '../billing/coupons';
import { announcementTargets, cleanTags, csvCell, normalizeTag, toCsv } from './admin.ops.service';
import { hasPermission } from './admin.permissions';

const coupon = (over: Record<string, any> = {}) => ({
  id: 'c1',
  code: 'DIWALI20',
  description: null,
  discountType: 'PERCENT',
  value: 20,
  maxRedemptions: null,
  redeemedCount: 0,
  onePerOrg: true,
  planTypes: [] as string[],
  validFrom: new Date('2026-01-01'),
  validUntil: null as Date | null,
  isActive: true,
  ...over,
});

describe('applyCoupon', () => {
  it('takes a percentage off, in whole paise', () => {
    expect(applyCoupon(79900, { discountType: 'PERCENT', value: 20 })).toEqual({ discountPaise: 15980, finalPaise: 63920 });
    expect(applyCoupon(99, { discountType: 'PERCENT', value: 50 })).toEqual({ discountPaise: 0, finalPaise: 99 });
  });

  it('takes a flat amount off', () => {
    expect(applyCoupon(79900, { discountType: 'FLAT', value: 10000 })).toEqual({ discountPaise: 10000, finalPaise: 69900 });
  });

  it('never goes below Razorpay\'s ₹1 minimum, and the parts always add up', () => {
    expect(applyCoupon(79900, { discountType: 'PERCENT', value: 100 })).toEqual({ discountPaise: 79800, finalPaise: 100 });
    expect(applyCoupon(79900, { discountType: 'FLAT', value: 10_000_000 })).toEqual({ discountPaise: 79800, finalPaise: 100 });
    for (const [amount, type, value] of [[179900, 'PERCENT', 33], [34990, 'FLAT', 777]] as const) {
      const r = applyCoupon(amount, { discountType: type, value });
      expect(r.discountPaise + r.finalPaise).toBe(amount);
    }
  });

  it('ignores an unknown discount type rather than guessing', () => {
    expect(applyCoupon(79900, { discountType: 'BOGUS', value: 50 })).toEqual({ discountPaise: 0, finalPaise: 79900 });
  });
});

describe('coupon codes and availability', () => {
  it('normalises and validates codes', () => {
    expect(normalizeCouponCode('  diwali20 ')).toBe('DIWALI20');
    expect(isValidCouponCode('DIWALI20')).toBe(true);
    expect(isValidCouponCode('AB')).toBe(false);
    expect(isValidCouponCode('HAS SPACE')).toBe(false);
  });

  it('says why a coupon cannot be used', () => {
    const now = new Date('2026-09-21');
    expect(couponProblem(coupon(), { planType: 'STARTER', now })).toBe(null);
    expect(couponProblem(null, { planType: 'STARTER', now })).toMatch(/not valid/);
    expect(couponProblem(coupon({ isActive: false }), { planType: 'STARTER', now })).toMatch(/not valid/);
    expect(couponProblem(coupon({ validFrom: new Date('2026-10-01') }), { planType: 'STARTER', now })).toMatch(/not active yet/);
    expect(couponProblem(coupon({ validUntil: new Date('2026-09-01') }), { planType: 'STARTER', now })).toMatch(/expired/);
    expect(couponProblem(coupon({ maxRedemptions: 5, redeemedCount: 5 }), { planType: 'STARTER', now })).toMatch(/fully used/);
    expect(couponProblem(coupon({ planTypes: ['PRO'] }), { planType: 'STARTER', now })).toMatch(/does not apply/);
    expect(couponProblem(coupon(), { planType: 'STARTER', now, alreadyUsedByOrg: true })).toMatch(/already used/);
    expect(couponProblem(coupon({ onePerOrg: false }), { planType: 'STARTER', now, alreadyUsedByOrg: true })).toBe(null);
  });
});

describe('tags', () => {
  it('normalises tags and drops duplicates and junk', () => {
    expect(normalizeTag(' Payment Follow Up! ')).toBe('payment-follow-up');
    expect(cleanTags(['VIP', 'vip', '', '  ', 'Hot Lead'])).toEqual(['vip', 'hot-lead']);
    expect(cleanTags('not-an-array')).toEqual([]);
  });
});

describe('announcement targeting', () => {
  const org = { id: 'o1', planType: 'STARTER' };
  it('reaches the right organizations', () => {
    expect(announcementTargets({ audience: 'ALL', planTypes: [], organizationIds: [] }, org)).toBe(true);
    expect(announcementTargets({ audience: 'PLANS', planTypes: ['STARTER'], organizationIds: [] }, org)).toBe(true);
    expect(announcementTargets({ audience: 'PLANS', planTypes: ['PRO'], organizationIds: [] }, org)).toBe(false);
    expect(announcementTargets({ audience: 'ORGS', planTypes: [], organizationIds: ['o1'] }, org)).toBe(true);
    expect(announcementTargets({ audience: 'ORGS', planTypes: [], organizationIds: ['o2'] }, org)).toBe(false);
    expect(announcementTargets({ audience: 'WHATEVER', planTypes: [], organizationIds: [] }, org)).toBe(false);
  });
});

describe('CSV', () => {
  it('quotes where needed and defuses spreadsheet formulas', () => {
    expect(csvCell('plain')).toBe('plain');
    expect(csvCell('a, b')).toBe('"a, b"');
    expect(csvCell('say "hi"')).toBe('"say ""hi"""');
    expect(csvCell('=HYPERLINK("x")')).toBe(`"'=HYPERLINK(""x"")"`);
    expect(csvCell('+91 98')).toBe("'+91 98");
    expect(csvCell(null)).toBe('');
    expect(csvCell(['a', 'b'])).toBe('a b');
    expect(toCsv(['h1', 'h2'], [[1, 'x']])).toBe('h1,h2\r\n1,x');
  });
});

describe('new permissions', () => {
  it('coupons are finance and super admin; announcements are admin and super admin', () => {
    expect(hasPermission('finance', 'coupons.write')).toBe(true);
    expect(hasPermission('admin', 'coupons.write')).toBe(false);
    expect(hasPermission('admin', 'announcements.write')).toBe(true);
    expect(hasPermission('support', 'announcements.write')).toBe(false);
    expect(hasPermission('support', 'data.export')).toBe(false);
  });
});

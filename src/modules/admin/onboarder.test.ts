// Onboarders, add-ons and client billing - pure rules.

import { describe, it, expect } from 'vitest';
import { ADDON_CATALOG, addOnBoosts, isAddOnActive, withBoost } from './addOns';
import { planMonthlyPaise } from './clientBilling';
import { hasPermission, permissionsFor } from './admin.permissions';

const row = (over: Record<string, any> = {}) => ({
  type: 'EXTRA_SEAT',
  quantity: 1,
  startsAt: new Date('2026-09-01'),
  endsAt: null as Date | null,
  removedAt: null as Date | null,
  ...over,
});

const now = new Date('2026-09-22');

describe('add-ons', () => {
  it('adds quantity x perUnit to the right limit', () => {
    expect(
      addOnBoosts([row({ quantity: 2 }), row({ type: 'EXTRA_NUMBER' }), row({ type: 'AI_TOPUP', quantity: 3 })], now)
    ).toEqual({ teamMembers: 2, whatsappNumbers: 1, aiRepliesPerDay: 3 * ADDON_CATALOG.AI_TOPUP.perUnit });
  });

  it('ignores removed, expired, not-yet-started, unknown and bill-only add-ons', () => {
    expect(
      addOnBoosts(
        [
          row({ removedAt: new Date('2026-09-10') }),
          row({ endsAt: new Date('2026-09-20') }),
          row({ startsAt: new Date('2026-10-01') }),
          row({ type: 'BOGUS' }),
          row({ type: 'CUSTOM' }),
        ],
        now
      )
    ).toEqual({});
    expect(isAddOnActive(row(), now)).toBe(true);
  });

  it('raises a real limit, never "no limit" or unlimited', () => {
    expect(withBoost(5, 2)).toBe(7);
    expect(withBoost(5, undefined)).toBe(5);
    expect(withBoost(null, 2)).toBe(null);
    expect(withBoost(undefined, 2)).toBe(undefined);
    expect(withBoost(999999, 2)).toBe(999999);
  });
});

describe('plan price per month', () => {
  it('uses the monthly price, or a twelfth of the yearly one', () => {
    const plan = { monthlyPrice: '799.00', yearlyPrice: '7990.00' };
    expect(planMonthlyPaise(plan, 'monthly')).toBe(79900);
    expect(planMonthlyPaise(plan, 'yearly')).toBe(66583);
    expect(planMonthlyPaise(null, 'monthly')).toBe(0);
  });
});

describe('onboarder role', () => {
  it('has only its own-clients permission', () => {
    expect(permissionsFor('onboarder')).toEqual(['clients.own']);
    expect(hasPermission('onboarder', 'orgs.read')).toBe(false);
    expect(hasPermission('onboarder', 'payments.verify')).toBe(false);
  });

  it('only finance and super admin verify offline payments', () => {
    expect(hasPermission('finance', 'payments.verify')).toBe(true);
    expect(hasPermission('super_admin', 'payments.verify')).toBe(true);
    expect(hasPermission('admin', 'payments.verify')).toBe(false);
  });
});

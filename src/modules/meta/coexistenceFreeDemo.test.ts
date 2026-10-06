import { beforeEach, describe, expect, it, vi } from 'vitest';

const planType = vi.fn();
vi.mock('../../middleware/planLimits', () => ({
  isSubscriptionActive: async () => ({ active: true, reason: '', daysRemaining: 1, planType: planType() }),
}));

const { assertCoexistenceAllowed, isFreeDemo } = await import('./coexistenceFreeDemo');

describe('coexistence on the free demo', () => {
  beforeEach(() => planType.mockReset());

  it('is refused, with a reason that says to upgrade', async () => {
    planType.mockReturnValue('FREE_DEMO');
    expect(await isFreeDemo('org')).toBe(true);
    await expect(assertCoexistenceAllowed('org')).rejects.toMatchObject({ statusCode: 403 });
    await expect(assertCoexistenceAllowed('org')).rejects.toThrow(/Upgrade your plan/);
  });

  it('is allowed on any paid plan', async () => {
    for (const p of ['STARTER', 'GROWTH', 'PRO', 'BUSINESS', 'MONTHLY']) {
      planType.mockReturnValue(p);
      await expect(assertCoexistenceAllowed('org')).resolves.toBeUndefined();
    }
  });
});

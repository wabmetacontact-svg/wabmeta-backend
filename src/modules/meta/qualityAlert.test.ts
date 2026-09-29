// A quality notification must go out once when the rating falls, not every
// night the sync sees the same low rating again, and never while an admin
// display override is telling the customer something else.

import { describe, it, expect, vi, beforeEach } from 'vitest';

const notifyOrganization = vi.fn();
vi.mock('../notifications/notifications.service', () => ({
  notificationsService: { notifyOrganization: (...a: any[]) => notifyOrganization(...a) },
}));

import { qualityDropped, qualityLevel, notifyIfQualityDropped } from './qualityAlert';

describe('qualityLevel', () => {
  it('reads both Meta colours and word forms', () => {
    expect(qualityLevel('GREEN')).toBe('HIGH');
    expect(qualityLevel('yellow')).toBe('MEDIUM');
    expect(qualityLevel('RED')).toBe('LOW');
    expect(qualityLevel('LOW')).toBe('LOW');
    expect(qualityLevel(null)).toBe('UNKNOWN');
    expect(qualityLevel('NA')).toBe('UNKNOWN');
  });
});

describe('qualityDropped', () => {
  it('fires on a fall', () => {
    expect(qualityDropped('GREEN', 'YELLOW')).toBe(true);
    expect(qualityDropped('GREEN', 'RED')).toBe(true);
    expect(qualityDropped('YELLOW', 'RED')).toBe(true);
    expect(qualityDropped(null, 'RED')).toBe(true);
    expect(qualityDropped('UNKNOWN', 'YELLOW')).toBe(true);
  });

  it('stays quiet when the rating holds or improves', () => {
    expect(qualityDropped('RED', 'RED')).toBe(false);
    expect(qualityDropped('YELLOW', 'YELLOW')).toBe(false);
    expect(qualityDropped('RED', 'YELLOW')).toBe(false);
    expect(qualityDropped('YELLOW', 'GREEN')).toBe(false);
    expect(qualityDropped('GREEN', 'UNKNOWN')).toBe(false);
  });
});

describe('notifyIfQualityDropped', () => {
  beforeEach(() => notifyOrganization.mockReset());

  const base = { accountId: 'a1', organizationId: 'o1', phoneNumber: '+91 98765 43210' };

  it('notifies the org when quality falls to Low', async () => {
    await notifyIfQualityDropped({ ...base, previous: 'GREEN', next: 'RED' });
    expect(notifyOrganization).toHaveBeenCalledTimes(1);
    const [orgId, payload] = notifyOrganization.mock.calls[0];
    expect(orgId).toBe('o1');
    expect(payload.type).toBe('whatsapp');
    expect(payload.title).toContain('Low');
    expect(payload.actionUrl).toBe('/dashboard');
  });

  it('does not repeat for an unchanged rating', async () => {
    await notifyIfQualityDropped({ ...base, previous: 'RED', next: 'RED' });
    expect(notifyOrganization).not.toHaveBeenCalled();
  });

  it('respects an admin display override', async () => {
    await notifyIfQualityDropped({ ...base, previous: 'GREEN', next: 'RED', override: 'GREEN' });
    expect(notifyOrganization).not.toHaveBeenCalled();
  });
});

// The rules behind admin control. A mistake here either lets a blocked
// customer keep sending, or silently blocks a customer who did nothing - so
// the "nothing set means nothing changes" cases matter as much as the blocks.

import { describe, it, expect } from 'vitest';
import {
  effectiveLimit,
  isOutboundMessageCall,
  istDayStart,
  parseLimitOverrides,
  parseOrgStatus,
  readOnlyAllows,
  UNLIMITED,
} from './orgControl';
import {
  base32Decode,
  base32Encode,
  lockAfterFailure,
  MAX_FAILED_LOGINS,
  signAdminToken,
  totpCode,
  verifyAdminToken,
  verifyTotp,
} from './admin.security';
import { hasPermission, permissionsFor } from './admin.permissions';
import { describeTarget, redactBody } from './admin.audit';
import { DEFAULT_SETTINGS, maintenanceExempt, normalizeSettings } from './systemSettings';
import { generateAccessToken, verifyAccessToken } from '../../utils/jwt';

describe('limit overrides', () => {
  it('keeps only known keys with positive whole numbers', () => {
    expect(
      parseLimitOverrides({ contacts: 5000, teamMembers: '8', bogus: 3, whatsappNumbers: 2.7 })
    ).toEqual({ contacts: 5000, teamMembers: 8, whatsappNumbers: 2 });
  });

  it('never turns a bad value into a limit of zero', () => {
    expect(parseLimitOverrides({ contacts: 0, messagesPerMonth: -5, aiRepliesPerDay: 'x' })).toEqual({});
    expect(parseLimitOverrides(null)).toEqual({});
    expect(parseLimitOverrides([1, 2])).toEqual({});
  });

  it('caps at the unlimited sentinel', () => {
    expect(parseLimitOverrides({ contacts: 10 ** 9 }).contacts).toBe(UNLIMITED);
  });

  it('falls back to the plan when no override is set', () => {
    expect(effectiveLimit({}, 'contacts', 2500)).toBe(2500);
    expect(effectiveLimit(undefined, 'contacts', null)).toBe(null);
    expect(effectiveLimit({ contacts: 9000 }, 'contacts', 2500)).toBe(9000);
  });
});

describe('organization status', () => {
  it('treats anything unknown as ACTIVE', () => {
    expect(parseOrgStatus('SUSPENDED')).toBe('SUSPENDED');
    expect(parseOrgStatus('READ_ONLY')).toBe('READ_ONLY');
    expect(parseOrgStatus(undefined)).toBe('ACTIVE');
    expect(parseOrgStatus('whatever')).toBe('ACTIVE');
  });

  it('read-only allows reads and paying, nothing else', () => {
    expect(readOnlyAllows('GET', '/api/contacts')).toBe(true);
    expect(readOnlyAllows('POST', '/api/billing/razorpay/create-order')).toBe(true);
    expect(readOnlyAllows('POST', '/api/wallet/topup/create-order')).toBe(true);
    expect(readOnlyAllows('POST', '/api/auth/logout')).toBe(true);

    expect(readOnlyAllows('POST', '/api/campaigns')).toBe(false);
    expect(readOnlyAllows('POST', '/api/inbox/conversations/1/messages')).toBe(false);
    expect(readOnlyAllows('DELETE', '/api/contacts/1')).toBe(false);
    // A path that merely starts with "wallet" is not the wallet route.
    expect(readOnlyAllows('POST', '/api/walletx')).toBe(false);
  });
});

describe('outbound message detection', () => {
  it('finds the phone number id on a message send', () => {
    expect(isOutboundMessageCall({ method: 'post', url: '123/messages', data: { to: '91' } })).toBe('123');
    expect(isOutboundMessageCall({ method: 'post', url: '/123/messages', data: '{"to":"91"}' })).toBe('123');
  });

  it('ignores read receipts, typing indicators and non-message calls', () => {
    expect(isOutboundMessageCall({ method: 'post', url: '123/messages', data: { status: 'read' } })).toBe(null);
    expect(
      isOutboundMessageCall({ method: 'post', url: '123/messages', data: JSON.stringify({ typing_indicator: {} }) })
    ).toBe(null);
    expect(isOutboundMessageCall({ method: 'get', url: '123/messages' })).toBe(null);
    expect(isOutboundMessageCall({ method: 'post', url: '123/media' })).toBe(null);
    expect(isOutboundMessageCall({ method: 'post', url: '/waba/message_templates' })).toBe(null);
  });
});

describe('IST day start', () => {
  it('is 18:30 UTC of the previous day', () => {
    expect(istDayStart(new Date('2026-09-21T10:00:00Z')).toISOString()).toBe('2026-09-20T18:30:00.000Z');
    // 20:00 UTC is already the next day in India.
    expect(istDayStart(new Date('2026-09-21T20:00:00Z')).toISOString()).toBe('2026-09-21T18:30:00.000Z');
  });
});

describe('TOTP', () => {
  it('matches the RFC 6238 SHA-1 test vectors', () => {
    const key = Buffer.from('12345678901234567890');
    expect(totpCode(key, Math.floor(59 / 30), 8)).toBe('94287082');
    expect(totpCode(key, Math.floor(1111111109 / 30), 8)).toBe('07081804');
    expect(totpCode(key, Math.floor(2000000000 / 30), 8)).toBe('69279037');
  });

  it('round-trips base32', () => {
    const buf = Buffer.from('12345678901234567890');
    expect(base32Encode(buf)).toBe('GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ');
    expect(base32Decode(base32Encode(buf)).equals(buf)).toBe(true);
  });

  it('accepts the current code and one step of drift, nothing further', () => {
    const secret = base32Encode(Buffer.from('12345678901234567890'));
    const now = 1111111109 * 1000;
    const code = (t: number) => totpCode(base32Decode(secret), Math.floor(t / 30));

    expect(verifyTotp(secret, code(1111111109), now)).toBe(true);
    expect(verifyTotp(secret, code(1111111109 - 30), now)).toBe(true);
    expect(verifyTotp(secret, code(1111111109 + 90), now)).toBe(false);
    expect(verifyTotp(secret, 'abcdef', now)).toBe(false);
    expect(verifyTotp(secret, '', now)).toBe(false);
  });
});

describe('admin lockout', () => {
  it('locks on the fifth failure and resets the counter', () => {
    const now = new Date('2026-09-21T10:00:00Z');
    expect(lockAfterFailure(0, now)).toEqual({ attempts: 1, lockedUntil: null });
    expect(lockAfterFailure(MAX_FAILED_LOGINS - 2, now).lockedUntil).toBe(null);

    const locked = lockAfterFailure(MAX_FAILED_LOGINS - 1, now);
    expect(locked.attempts).toBe(0);
    expect(locked.lockedUntil!.getTime()).toBe(now.getTime() + 15 * 60_000);
  });
});

describe('admin tokens', () => {
  it('an admin token works on the admin API only', () => {
    const token = signAdminToken({ adminId: 'a1', email: 'a@x.com', role: 'admin' });
    expect(verifyAdminToken(token).adminId).toBe('a1');
  });

  it('a user token is rejected by the admin API', () => {
    const userToken = generateAccessToken({ userId: 'u1', email: 'u@x.com', tokenVersion: 0 });
    expect(() => verifyAdminToken(userToken)).toThrow();
    expect(verifyAccessToken(userToken).userId).toBe('u1');
  });
});

describe('admin permissions', () => {
  it('super admin can do everything, unknown roles nothing', () => {
    expect(hasPermission('super_admin', 'wallet.money')).toBe(true);
    expect(hasPermission('super_admin', 'impersonate')).toBe(true);
    expect(permissionsFor('hacker')).toEqual([]);
    expect(permissionsFor(undefined)).toEqual([]);
  });

  it('only super admin and finance move money', () => {
    expect(hasPermission('finance', 'wallet.money')).toBe(true);
    expect(hasPermission('admin', 'wallet.money')).toBe(false);
    expect(hasPermission('support', 'wallet.money')).toBe(false);
  });

  it('support can look and end sessions but not block or delete', () => {
    expect(hasPermission('support', 'users.read')).toBe(true);
    expect(hasPermission('support', 'sessions.manage')).toBe(true);
    expect(hasPermission('support', 'orgs.status')).toBe(false);
    expect(hasPermission('support', 'users.delete')).toBe(false);
  });

  it('only super admin can view as a user', () => {
    for (const role of ['admin', 'support', 'finance']) {
      expect(hasPermission(role, 'impersonate')).toBe(false);
    }
  });
});

describe('audit log', () => {
  it('redacts anything secret-looking at any depth', () => {
    expect(
      redactBody({ password: 'x', nested: { otp: '123456', accessToken: 't', name: 'ok' }, list: [{ secret: 1 }] })
    ).toEqual({
      password: '[redacted]',
      nested: { otp: '[redacted]', accessToken: '[redacted]', name: 'ok' },
      list: [{ secret: '[redacted]' }],
    });
  });

  it('works out what an action touched', () => {
    expect(describeTarget('/organizations/:id/status', { id: 'o1' }, {})).toEqual({
      targetType: 'organization',
      targetId: 'o1',
      organizationId: 'o1',
    });
    expect(describeTarget('/users/:id/impersonate', { id: 'u1' }, { organizationId: 'o2' })).toEqual({
      targetType: 'user',
      targetId: 'u1',
      organizationId: 'o2',
    });
    expect(describeTarget('/admin/wallets/:organizationId/toggle', { organizationId: 'o4' }, {})).toEqual({
      targetType: 'organization',
      targetId: 'o4',
      organizationId: 'o4',
    });
    expect(describeTarget('/wallets/:organizationId/adjust', { organizationId: 'o3' }, {})).toEqual({
      targetType: 'organization',
      targetId: 'o3',
      organizationId: 'o3',
    });
  });
});

describe('system settings', () => {
  it('fills defaults and ignores wrong types', () => {
    expect(normalizeSettings(null)).toEqual(DEFAULT_SETTINGS);
    const s = normalizeSettings({ maintenanceMode: 'yes', allowRegistration: false, maxOrganizationsPerUser: 0 });
    expect(s.maintenanceMode).toBe(false);
    expect(s.allowRegistration).toBe(false);
    expect(s.maxOrganizationsPerUser).toBe(DEFAULT_SETTINGS.maxOrganizationsPerUser);
  });

  it('keeps admin, webhooks and status reachable during maintenance', () => {
    expect(maintenanceExempt('/api/admin/settings')).toBe(true);
    expect(maintenanceExempt('/api/webhooks/whatsapp')).toBe(true);
    expect(maintenanceExempt('/api/system/status')).toBe(true);
    expect(maintenanceExempt('/api/health')).toBe(true);

    expect(maintenanceExempt('/api/contacts')).toBe(false);
    expect(maintenanceExempt('/api/auth/login')).toBe(false);
    expect(maintenanceExempt('/api/administrator')).toBe(false);
  });
});

import { describe, expect, it } from 'vitest';
import { IMPERSONATION_BLOCKED_MESSAGE, impersonationBlocks } from './impersonation';

describe('what the admin view may change', () => {
  it('reads anything', () => {
    for (const p of ['/api/billing/subscription', '/api/users/profile']) {
      expect(impersonationBlocks('GET', p)).toBeNull();
    }
  });

  it('sets the client up: templates, contacts, campaigns, chatbots, settings, team', () => {
    expect(impersonationBlocks('POST', '/api/templates')).toBeNull();
    expect(impersonationBlocks('PUT', '/api/contacts/1')).toBeNull();
    expect(impersonationBlocks('DELETE', '/api/contacts/1')).toBeNull();
    expect(impersonationBlocks('POST', '/api/campaigns')).toBeNull();
    expect(impersonationBlocks('PATCH', '/api/chatbots/1')).toBeNull();
    expect(impersonationBlocks('POST', '/api/telegram/automations')).toBeNull();
    expect(impersonationBlocks('PUT', '/api/organizations/org1')).toBeNull();
    expect(impersonationBlocks('POST', '/api/organizations/org1/members')).toBeNull();
    expect(impersonationBlocks('PUT', '/api/payments/gateway')).toBeNull();
  });

  it('replies from the inbox on every channel, and uses the wallet', () => {
    expect(impersonationBlocks('POST', '/api/inbox/conversations/1/messages')).toBeNull();
    expect(impersonationBlocks('PATCH', '/api/inbox/conversations/1')).toBeNull();
    expect(impersonationBlocks('POST', '/api/instagram/send')).toBeNull();
    expect(impersonationBlocks('POST', '/api/telegram/send-media')).toBeNull();
    expect(impersonationBlocks('POST', '/api/wallet/topup/create-order')).toBeNull();
    expect(impersonationBlocks('POST', '/api/wallet/topup/verify')).toBeNull();
  });

  it("never touches the client's login or takes the account from them", () => {
    expect(impersonationBlocks('POST', '/api/auth/change-password')).toBe('account');
    expect(impersonationBlocks('POST', '/api/auth/logout-all')).toBe('account');
    expect(impersonationBlocks('PUT', '/api/users/profile')).toBe('account');
    expect(impersonationBlocks('DELETE', '/api/users/account')).toBe('account');
    expect(impersonationBlocks('DELETE', '/api/organizations/org1')).toBe('account');
    expect(impersonationBlocks('POST', '/api/organizations/org1/transfer')).toBe('account');
    expect(impersonationBlocks('POST', '/api/organizations/org1/leave')).toBe('account');
  });

  it('never changes the plan', () => {
    expect(impersonationBlocks('POST', '/api/billing/upgrade')).toBe('billing');
    expect(impersonationBlocks('POST', '/api/billing/cancel')).toBe('billing');
    expect(impersonationBlocks('POST', '/api/billing/razorpay/create-order')).toBe('billing');
  });

  it('matches whole path segments only', () => {
    expect(impersonationBlocks('POST', '/api/usersettings')).toBeNull();
    expect(impersonationBlocks('POST', '/api/billingx')).toBeNull();
  });

  it('says why, for every area it blocks', () => {
    for (const area of ['account', 'billing']) expect(IMPERSONATION_BLOCKED_MESSAGE[area]).toBeTruthy();
  });
});

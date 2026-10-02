// The admin's live Razorpay list: which account, which day range, and where
// each payment belongs (a QR or link payment has no WabMeta customer).

import { describe, it, expect } from 'vitest';
import { classifyPayment, istRangeToUnix, needsReconcile, parseRazorpayPaymentsQuery } from './razorpayPayments';

describe('parseRazorpayPaymentsQuery', () => {
  it('defaults to the plans account, page 1', () => {
    expect(parseRazorpayPaymentsQuery({})).toEqual({
      account: 'plans', from: undefined, to: undefined, paymentId: undefined, page: 1, limit: 50,
    });
  });

  it('keeps a valid account, dates and a pay_ id, and drops the rest', () => {
    expect(parseRazorpayPaymentsQuery({ account: 'wallet', from: '2026-10-01', to: 'today', q: ' pay_QmA81Kx2LwZr3T ', page: '3' }))
      .toMatchObject({ account: 'wallet', from: '2026-10-01', to: undefined, paymentId: 'pay_QmA81Kx2LwZr3T', page: 3 });
    expect(parseRazorpayPaymentsQuery({ account: 'everything', q: 'acme' }))
      .toMatchObject({ account: 'plans', paymentId: undefined });
  });
});

describe('istRangeToUnix', () => {
  it('uses India-time day boundaries', () => {
    expect(istRangeToUnix('2026-10-01', '2026-10-01')).toEqual({
      from: Date.parse('2026-09-30T18:30:00Z') / 1000,
      to: Date.parse('2026-10-01T18:29:59Z') / 1000,
    });
    expect(istRangeToUnix()).toEqual({});
  });
});

describe('classifyPayment', () => {
  const none = { plan: false, wallet: false };

  it('recorded payments belong to a plan or a wallet top-up', () => {
    expect(classifyPayment({}, { plan: true, wallet: false })).toBe('plan');
    expect(classifyPayment({}, { plan: false, wallet: true })).toBe('wallet');
  });

  it("WabMeta's checkout notes say what an unrecorded payment was for", () => {
    expect(classifyPayment({ planId: 'p1', organizationId: 'o1' }, none)).toBe('plan');
    expect(classifyPayment({ purpose: 'wallet_topup' }, none)).toBe('wallet');
  });

  it('QR code, link or page money is direct', () => {
    expect(classifyPayment({}, none)).toBe('direct');
    expect(classifyPayment(null, none)).toBe('direct');
    expect(classifyPayment({ qr_note: 'shop counter' }, none)).toBe('direct');
  });
});

describe('needsReconcile', () => {
  it('flags money kept from a WabMeta checkout that was not recorded', () => {
    expect(needsReconcile('captured', 'plan', false)).toBe(true);
    expect(needsReconcile('refunded', 'wallet', false)).toBe(true);
  });

  it('ignores recorded, failed, unfinished and direct payments', () => {
    expect(needsReconcile('captured', 'plan', true)).toBe(false);
    expect(needsReconcile('failed', 'plan', false)).toBe(false);
    expect(needsReconcile('created', 'wallet', false)).toBe(false);
    expect(needsReconcile('captured', 'direct', false)).toBe(false);
  });
});

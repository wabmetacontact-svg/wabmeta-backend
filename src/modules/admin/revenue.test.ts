// Revenue must be exactly the money received, counted once.

import { describe, it, expect } from 'vitest';
import { istDayStart, istMonthStart } from './revenue';
import { diffPayments } from './reconcile';

describe('India-time boundaries', () => {
  it('month starts at 18:30 UTC on the last day of the previous month', () => {
    expect(istMonthStart(new Date('2026-09-22T10:00:00Z')).toISOString()).toBe('2026-08-31T18:30:00.000Z');
    // 20:00 UTC on 30 Sept is already 1 Oct in India.
    expect(istMonthStart(new Date('2026-09-30T20:00:00Z')).toISOString()).toBe('2026-09-30T18:30:00.000Z');
    expect(istDayStart(new Date('2026-09-22T10:00:00Z')).toISOString()).toBe('2026-09-21T18:30:00.000Z');
  });
});

describe('matching Razorpay against our records', () => {
  const rp = (id: string, amount: number, status = 'captured', amount_refunded = 0) =>
    ({ id, amount, status, amount_refunded, created_at: 0 });

  it('finds payments Razorpay collected that we never recorded', () => {
    const r = diffPayments(
      [rp('pay_1', 79900), rp('pay_2', 50000), rp('pay_3', 10000, 'failed'), rp('pay_4', 10000, 'authorized')],
      [{ razorpayPaymentId: 'pay_1', amountPaise: 79900, refundedPaise: 0, kind: 'plan' }]
    );
    expect(r.missing.map((p) => p.id)).toEqual(['pay_2']);
    expect(r.missingPaise).toBe(50000);
    expect(r.collectedCount).toBe(2);
    expect(r.collectedPaise).toBe(129900);
  });

  it('flags a different amount or an unrecorded refund', () => {
    const r = diffPayments(
      [rp('pay_1', 79900), rp('pay_2', 50000, 'refunded', 50000), rp('pay_3', 20000)],
      [
        { razorpayPaymentId: 'pay_1', amountPaise: 70000, refundedPaise: 0, kind: 'plan' },
        { razorpayPaymentId: 'pay_2', amountPaise: 50000, refundedPaise: 0, kind: 'plan' },
        { razorpayPaymentId: 'pay_3', amountPaise: 20000, refundedPaise: 0, kind: 'wallet' },
      ]
    );
    expect(r.missing).toEqual([]);
    expect(r.amountMismatch.map((m) => m.payment.id)).toEqual(['pay_1']);
    expect(r.refundMismatch.map((m) => m.payment.id)).toEqual(['pay_2']);
    // A fully refunded payment brought in nothing.
    expect(r.collectedPaise).toBe(79900 + 0 + 20000);
  });
});

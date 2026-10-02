// The admin's Plan payments filters: bad input is dropped, dates are India
// time, and a failed attempt is found by the order id kept in its notes.

import { describe, it, expect } from 'vitest';
import { parsePlanPaymentQuery, planPaymentWhere } from './planPayments';

describe('parsePlanPaymentQuery', () => {
  it('keeps valid values and drops the rest', () => {
    expect(parsePlanPaymentQuery({ status: 'failed', q: '  pay_123 ', from: '2026-10-01', to: 'yesterday', page: '2', limit: '500' }))
      .toEqual({ status: 'FAILED', q: 'pay_123', from: '2026-10-01', to: undefined, page: 2, limit: 100 });
  });

  it('defaults to every status, page 1, 50 rows', () => {
    expect(parsePlanPaymentQuery({ status: 'PENDING', page: '-3', limit: 'abc' }))
      .toEqual({ status: undefined, q: undefined, from: undefined, to: undefined, page: 1, limit: 50 });
  });
});

describe('planPaymentWhere', () => {
  it('turns a date range into India-time day boundaries', () => {
    const where = planPaymentWhere(parsePlanPaymentQuery({ from: '2026-10-01', to: '2026-10-02' })) as any;
    const range = where.AND[0].createdAt;
    expect(range.gte.toISOString()).toBe('2026-09-30T18:30:00.000Z');
    expect(range.lte.toISOString()).toBe('2026-10-02T18:29:59.999Z');
  });

  it('searches the order id in notes too, where failed attempts keep it', () => {
    const where = planPaymentWhere(parsePlanPaymentQuery({ q: 'order_ABC' })) as any;
    expect(where.AND[0].OR).toContainEqual({ notes: { path: ['razorpayOrderId'], equals: 'order_ABC' } });
  });

  it('adds the status on top of the other filters', () => {
    const where = planPaymentWhere(parsePlanPaymentQuery({ status: 'SUCCESS', q: 'acme' })) as any;
    expect(where.AND[1]).toEqual({ status: 'SUCCESS' });
  });

  it('is empty with no filters', () => {
    expect(planPaymentWhere(parsePlanPaymentQuery({}))).toEqual({});
  });
});

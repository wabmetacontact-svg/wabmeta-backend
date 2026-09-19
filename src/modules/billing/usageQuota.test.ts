// These are the numbers that decide whether a paying customer can send their
// campaign. Too loose and the tiers are decorative; too tight and someone who
// paid gets stopped mid-campaign. The case that matters most is missing plan
// data: it must read as "no limit", never as "limit zero".

import { describe, it, expect } from 'vitest';
import {
  limitFromPlan,
  quotaFrom,
  monthStart,
  nextResetDate,
  UNLIMITED_AT,
} from './usageQuota';

describe('limitFromPlan', () => {
  it('keeps a real limit', () => {
    expect(limitFromPlan(5000)).toBe(5000);
    expect(limitFromPlan(10000)).toBe(10000);
  });

  it('treats the plans\' unlimited marker as no limit', () => {
    expect(limitFromPlan(UNLIMITED_AT)).toBeNull();
    expect(limitFromPlan(UNLIMITED_AT + 1)).toBeNull();
  });

  it('treats missing or nonsense data as no limit, never as zero', () => {
    // A plan row that failed to load must not lock the customer out.
    expect(limitFromPlan(null)).toBeNull();
    expect(limitFromPlan(undefined)).toBeNull();
    expect(limitFromPlan(0)).toBeNull();
    expect(limitFromPlan(-100)).toBeNull();
    expect(limitFromPlan(NaN)).toBeNull();
    expect(limitFromPlan('abc' as any)).toBeNull();
  });

  it('never returns a fraction', () => {
    expect(limitFromPlan(5000.9)).toBe(5000);
  });
});

describe('quotaFrom', () => {
  it('reports what is left', () => {
    const q = quotaFrom(3000, 10000);
    expect(q.remaining).toBe(7000);
    expect(q.percentage).toBe(30);
  });

  it('crosses 80% where the usage bar turns yellow', () => {
    expect(quotaFrom(7999, 10000).percentage).toBe(80);
    expect(quotaFrom(8000, 10000).percentage).toBe(80);
  });

  it('never goes past 100% or below zero remaining', () => {
    const q = quotaFrom(12000, 10000);
    expect(q.percentage).toBe(100);
    expect(q.remaining).toBe(0);
  });

  it('an unlimited plan has nothing left to run out of', () => {
    const q = quotaFrom(50000, null);
    expect(q.limit).toBeNull();
    expect(q.remaining).toBeNull();
    expect(q.percentage).toBe(0);
  });

  it('shrugs off a rubbish used count', () => {
    expect(quotaFrom(NaN, 100).used).toBe(0);
    expect(quotaFrom(-5, 100).used).toBe(0);
  });
});

describe('the billing month', () => {
  it('starts at midnight on the first', () => {
    const d = monthStart(new Date('2026-09-19T17:45:12.345Z'));
    expect(d.getDate()).toBe(1);
    expect(d.getHours()).toBe(0);
    expect(d.getMinutes()).toBe(0);
    expect(d.getSeconds()).toBe(0);
    expect(d.getMilliseconds()).toBe(0);
  });

  it('resets on the first of the next month', () => {
    const d = nextResetDate(new Date('2026-09-19T10:00:00'));
    expect(d.getDate()).toBe(1);
    expect(d.getMonth()).toBe(9); // October
  });

  it('rolls into the next year in December', () => {
    const d = nextResetDate(new Date('2026-12-15T10:00:00'));
    expect(d.getMonth()).toBe(0);
    expect(d.getFullYear()).toBe(2027);
  });
});

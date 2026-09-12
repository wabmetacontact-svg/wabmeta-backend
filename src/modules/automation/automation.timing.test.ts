/**
 * Pure timing rules for follow-ups. No database: these only need the test
 * guard's DATABASE_URL to be the local test DB string, nothing connects.
 */
import { describe, expect, it } from 'vitest';
import {
  delayToMs,
  waitTimeoutMs,
  parseHHMM,
  quietHoursEndsAt,
  isWindowOpen,
  retryBackoffMs,
} from './automation.timing';

const HOUR = 60 * 60 * 1000;

describe('delayToMs', () => {
  it('reads the builder field `value` and the legacy `duration`', () => {
    expect(delayToMs({ value: 2, unit: 'days' })).toBe(48 * HOUR);
    expect(delayToMs({ duration: 90, unit: 'minutes' })).toBe(1.5 * HOUR);
  });

  it('defaults to seconds and ignores nonsense', () => {
    expect(delayToMs({ value: 10 })).toBe(10_000);
    expect(delayToMs({ value: 5, unit: 'fortnights' })).toBe(5_000);
    expect(delayToMs({ value: -1, unit: 'hours' })).toBe(0);
    expect(delayToMs({ value: 'abc', unit: 'hours' })).toBe(0);
  });
});

describe('waitTimeoutMs', () => {
  it('prefers timeoutValue/timeoutUnit, falls back to legacy ms `timeout`', () => {
    expect(waitTimeoutMs({ timeoutValue: 24, timeoutUnit: 'hours' })).toBe(24 * HOUR);
    expect(waitTimeoutMs({ timeoutValue: 3 })).toBe(3 * HOUR);
    expect(waitTimeoutMs({ timeout: 5000 })).toBe(5000);
  });

  it('returns null when no timeout is configured', () => {
    expect(waitTimeoutMs({})).toBeNull();
    expect(waitTimeoutMs({ timeoutValue: 0 })).toBeNull();
  });
});

describe('parseHHMM', () => {
  it('parses valid times and rejects invalid ones', () => {
    expect(parseHHMM('09:00')).toBe(540);
    expect(parseHHMM('21:30')).toBe(1290);
    expect(parseHHMM('24:00')).toBeNull();
    expect(parseHHMM('9am')).toBeNull();
    expect(parseHHMM(undefined)).toBeNull();
  });
});

describe('quietHoursEndsAt (Asia/Kolkata, UTC+5:30)', () => {
  const overnight = { enabled: true, start: '21:00', end: '09:00', timezone: 'Asia/Kolkata' };

  it('is null when disabled', () => {
    const at = new Date('2026-09-11T17:30:00Z'); // 23:00 IST
    expect(quietHoursEndsAt(at, { ...overnight, enabled: false })).toBeNull();
  });

  it('is null during the day', () => {
    const at = new Date('2026-09-11T06:30:00Z'); // 12:00 IST
    expect(quietHoursEndsAt(at, overnight)).toBeNull();
  });

  it('pushes a late-night send to 09:00 IST next morning', () => {
    const at = new Date('2026-09-11T17:30:00Z'); // 23:00 IST
    expect(quietHoursEndsAt(at, overnight)?.toISOString()).toBe('2026-09-12T03:30:00.000Z');
  });

  it('pushes an early-morning send to 09:00 IST the same day', () => {
    const at = new Date('2026-09-11T00:30:00Z'); // 06:00 IST
    expect(quietHoursEndsAt(at, overnight)?.toISOString()).toBe('2026-09-11T03:30:00.000Z');
  });

  it('handles a same-day window and treats its end as open', () => {
    const lunch = { enabled: true, start: '13:00', end: '14:00', timezone: 'Asia/Kolkata' };
    expect(quietHoursEndsAt(new Date('2026-09-11T07:45:00Z'), lunch)?.toISOString())
      .toBe('2026-09-11T08:30:00.000Z'); // 13:15 IST -> 14:00 IST
    expect(quietHoursEndsAt(new Date('2026-09-11T08:30:00Z'), lunch)).toBeNull(); // 14:00 IST
  });

  it('never blocks on a bad config', () => {
    const at = new Date('2026-09-11T17:30:00Z');
    expect(quietHoursEndsAt(at, { ...overnight, start: 'late' })).toBeNull();
    expect(quietHoursEndsAt(at, { ...overnight, end: '21:00' })).toBeNull();
    expect(quietHoursEndsAt(at, { ...overnight, timezone: 'Mars/Olympus' })).toBeNull();
  });
});

describe('isWindowOpen', () => {
  const now = new Date('2026-09-11T12:00:00Z');

  it('trusts windowExpiresAt first', () => {
    expect(isWindowOpen({ windowExpiresAt: '2026-09-11T13:00:00Z' }, now)).toBe(true);
    expect(isWindowOpen({ windowExpiresAt: '2026-09-11T11:00:00Z', isWindowOpen: true }, now)).toBe(false);
  });

  it('falls back to isWindowOpen=false, then the last customer message', () => {
    expect(isWindowOpen({ isWindowOpen: false, lastCustomerMessageAt: now }, now)).toBe(false);
    expect(isWindowOpen({ lastCustomerMessageAt: '2026-09-10T13:00:00Z' }, now)).toBe(true);
    expect(isWindowOpen({ lastCustomerMessageAt: '2026-09-10T11:00:00Z' }, now)).toBe(false);
  });

  it('is closed with no conversation or no customer message', () => {
    expect(isWindowOpen(null, now)).toBe(false);
    expect(isWindowOpen({ isWindowOpen: true }, now)).toBe(false);
  });
});

describe('retryBackoffMs', () => {
  it('backs off 2, 4, 8 minutes', () => {
    expect(retryBackoffMs(1)).toBe(2 * 60_000);
    expect(retryBackoffMs(2)).toBe(4 * 60_000);
    expect(retryBackoffMs(3)).toBe(8 * 60_000);
  });
});

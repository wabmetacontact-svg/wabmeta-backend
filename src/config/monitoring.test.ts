// initMonitoring() bootstrap() ke try block se chalta hai - wahan se throw
// hone ka matlab process.exit(1) hai. Rate limit Redis store theek isi tarah
// production gira chuka hai (ek optional cheez ne poori API le li), isliye
// yahan DSN pehle check hota hai aur init try/catch me hai.

import { describe, it, expect } from 'vitest';
import { isValidSentryDsn } from './monitoring';

describe('isValidSentryDsn', () => {
  it('asli shape wala DSN accept karta hai', () => {
    expect(isValidSentryDsn('https://abc123def456@o4507.ingest.sentry.io/4507123')).toBe(true);
    expect(isValidSentryDsn('  https://key@host.example.com/42  ')).toBe(true);
  });

  it('khali ya missing reject', () => {
    expect(isValidSentryDsn('')).toBe(false);
    expect(isValidSentryDsn('   ')).toBe(false);
    expect(isValidSentryDsn(undefined as any)).toBe(false);
  });

  it('galat shape reject - yahi wo cases hain jo Sentry.init par throw karte', () => {
    expect(isValidSentryDsn('not-a-dsn')).toBe(false);
    expect(isValidSentryDsn('http://key@host/1')).toBe(false);      // https hi chahiye
    expect(isValidSentryDsn('https://host/1')).toBe(false);         // key nahi
    expect(isValidSentryDsn('https://key@host')).toBe(false);       // project id nahi
    expect(isValidSentryDsn('https://key@host/abc')).toBe(false);   // project id number nahi
    expect(isValidSentryDsn('https://key with space@host/1')).toBe(false);
  });
});

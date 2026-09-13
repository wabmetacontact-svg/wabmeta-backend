// Lockout ki poori policy yahin hai. Galat hua to ya to brute force khula reh
// jayega, ya genuine user apne hi account se bahar ho jayega - dono mehenge
// hain, isliye dono taraf ke case test me hain.

import { describe, it, expect } from 'vitest';
import {
  lockStatus,
  nextStateAfterFailure,
  clearedState,
  lockoutMessage,
  MAX_FAILED_ATTEMPTS,
  LOCKOUT_MINUTES,
  ATTEMPT_WINDOW_MINUTES,
} from './loginLockout';

const NOW = new Date('2026-09-13T10:00:00Z');
const minutesAgo = (m: number) => new Date(NOW.getTime() - m * 60 * 1000);

describe('lockStatus', () => {
  it('lockedUntil na ho to locked nahi', () => {
    expect(lockStatus({ lockedUntil: null }, NOW)).toEqual({ locked: false, secondsRemaining: 0 });
  });

  it('guzra hua lock khatam maana jata hai', () => {
    expect(lockStatus({ lockedUntil: minutesAgo(1) }, NOW).locked).toBe(false);
  });

  it('aage ka lock abhi chalu hai, bacha waqt ke saath', () => {
    const until = new Date(NOW.getTime() + 5 * 60 * 1000);
    const r = lockStatus({ lockedUntil: until }, NOW);
    expect(r.locked).toBe(true);
    expect(r.secondsRemaining).toBe(300);
  });
});

describe('nextStateAfterFailure', () => {
  it('pehli galti par ginti 1, lock nahi', () => {
    const r = nextStateAfterFailure({ failedLoginAttempts: 0, lockedUntil: null, lastFailedAt: null }, NOW);
    expect(r.failedLoginAttempts).toBe(1);
    expect(r.lockedUntil).toBeNull();
  });

  it('window ke andar ginti badhti hai', () => {
    const r = nextStateAfterFailure(
      { failedLoginAttempts: 3, lockedUntil: null, lastFailedAt: minutesAgo(5) },
      NOW
    );
    expect(r.failedLoginAttempts).toBe(4);
    expect(r.lockedUntil).toBeNull();
  });

  it('threshold par account lock ho jata hai', () => {
    const r = nextStateAfterFailure(
      { failedLoginAttempts: MAX_FAILED_ATTEMPTS - 1, lockedUntil: null, lastFailedAt: minutesAgo(1) },
      NOW
    );
    expect(r.failedLoginAttempts).toBe(MAX_FAILED_ATTEMPTS);
    expect(r.lockedUntil).toEqual(new Date(NOW.getTime() + LOCKOUT_MINUTES * 60 * 1000));
  });

  it('window ke bahar purani failures ginti me nahi aatin', () => {
    // Genuine user jo mahine me 7 baar galti kar chuka hai, aaj lock na ho.
    const r = nextStateAfterFailure(
      {
        failedLoginAttempts: MAX_FAILED_ATTEMPTS - 1,
        lockedUntil: null,
        lastFailedAt: minutesAgo(ATTEMPT_WINDOW_MINUTES + 1),
      },
      NOW
    );
    expect(r.failedLoginAttempts).toBe(1);
    expect(r.lockedUntil).toBeNull();
  });

  it('lagatar galtiyan lock tak pahunchti hain', () => {
    let state = { failedLoginAttempts: 0, lockedUntil: null as Date | null, lastFailedAt: null as Date | null };
    for (let i = 1; i <= MAX_FAILED_ATTEMPTS; i++) {
      const next = nextStateAfterFailure(state, NOW);
      state = { ...next, lastFailedAt: NOW };
      if (i < MAX_FAILED_ATTEMPTS) expect(next.lockedUntil).toBeNull();
    }
    expect(state.lockedUntil).not.toBeNull();
  });
});

describe('clearedState', () => {
  it('kamyab login sab kuch saaf karta hai', () => {
    expect(clearedState()).toEqual({ failedLoginAttempts: 0, lockedUntil: null });
  });
});

describe('lockoutMessage', () => {
  it('minute me batata hai aur kabhi "0 minutes" nahi kehta', () => {
    expect(lockoutMessage(1)).toContain('1 minute');
    expect(lockoutMessage(300)).toContain('5 minutes');
    expect(lockoutMessage(0)).toContain('1 minute');
  });
});

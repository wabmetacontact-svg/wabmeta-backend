// src/modules/templates/optOutNotice.test.ts
//
// Ye function business ke apne footer ke saath ched-chaad karta hai, isliye
// asli sawaal ye hai ki wo kab NAHI chhedta.

import { describe, it, expect } from 'vitest';
import { withOptOutNotice } from './templates.service';

describe('withOptOutNotice', () => {
  it('adds the notice to a marketing template with no footer', () => {
    expect(withOptOutNotice('MARKETING', null)).toBe('Reply STOP to unsubscribe');
    expect(withOptOutNotice('MARKETING', '')).toBe('Reply STOP to unsubscribe');
    expect(withOptOutNotice('marketing', '   ')).toBe('Reply STOP to unsubscribe');
  });

  it('appends to a short business footer', () => {
    expect(withOptOutNotice('MARKETING', 'Team WabMeta'))
      .toBe('Team WabMeta · Reply STOP to unsubscribe');
  });

  it('leaves a long footer untouched rather than truncating it', () => {
    const long = 'Visit our store at 42 Park Street, Kolkata for more offers';
    expect(withOptOutNotice('MARKETING', long)).toBe(long);
    expect(withOptOutNotice('MARKETING', long).length).toBeLessThanOrEqual(60);
  });

  it('never exceeds the 60 character footer limit', () => {
    for (const f of ['', 'Team WabMeta', 'Thanks for shopping with us today friend']) {
      const out = withOptOutNotice('MARKETING', f) || '';
      expect(out.length, `"${f}" -> "${out}"`).toBeLessThanOrEqual(60);
    }
  });

  it('does not double up when the footer already offers an opt-out', () => {
    for (const f of [
      'Reply STOP to unsubscribe',
      'Send STOP to opt out',
      'Text UNSUBSCRIBE to stop',
      'Reply stop anytime',
    ]) {
      expect(withOptOutNotice('MARKETING', f), f).toBe(f);
    }
  });

  it('leaves utility and authentication templates alone', () => {
    expect(withOptOutNotice('UTILITY', 'Team WabMeta')).toBe('Team WabMeta');
    expect(withOptOutNotice('AUTHENTICATION', null)).toBeNull();
    expect(withOptOutNotice('UTILITY', null)).toBeNull();
  });
});

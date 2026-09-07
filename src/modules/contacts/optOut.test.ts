// src/modules/contacts/optOut.test.ts
//
// Yahan asli risk false positive hai, false negative nahi.
// Ek chhoota hua "stop" ka matlab hai ek aur campaign us bande ko jayega.
// Ek galat "stop" ka matlab hai customer hamesha ke liye chala gaya, aur
// business ko pata bhi nahi chalega. Isliye zyadatar test yahi dekhte hain
// ki jo opt-out NAHI hai use opt-out na samjha jaye.

import { describe, it, expect } from 'vitest';
import { detectOptSignal } from './optOut';

describe('detectOptSignal', () => {
  it('catches the plain opt-out words', () => {
    for (const t of ['stop', 'STOP', 'Stop', 'unsubscribe', 'UNSUB', 'opt out', 'optout', 'remove me']) {
      expect(detectOptSignal(t), t).toBe('OPT_OUT');
    }
  });

  it("catches WhatsApp's own Stop promotions button text", () => {
    expect(detectOptSignal('Stop promotions')).toBe('OPT_OUT');
  });

  it('catches the Hinglish forms', () => {
    for (const t of ['band karo', 'BAND KRO', 'band kar do', 'mat bhejo']) {
      expect(detectOptSignal(t), t).toBe('OPT_OUT');
    }
  });

  it('ignores trailing punctuation and stray spacing', () => {
    for (const t of ['stop.', 'STOP!', '  stop  ', 'stop?', 'band  karo']) {
      expect(detectOptSignal(t), t).toBe('OPT_OUT');
    }
  });

  it('catches opt-in words', () => {
    for (const t of ['start', 'SUBSCRIBE', 'resume', 'chalu karo']) {
      expect(detectOptSignal(t), t).toBe('OPT_IN');
    }
  });

  // ── The important half ────────────────────────────────────────────────
  it('does not fire when the word only appears inside a sentence', () => {
    const notOptOuts = [
      'bus stop par milte hain',
      "don't stop sending offers",
      'please stop by our shop tomorrow',
      'stop karne ki zarurat nahi hai',
      'I want to subscribe to your newsletter please',
      'where is the nearest stop',
      'can you start the delivery tomorrow morning',
    ];
    for (const t of notOptOuts) {
      expect(detectOptSignal(t), t).toBeNull();
    }
  });

  it('ignores empty and non-text input', () => {
    expect(detectOptSignal('')).toBeNull();
    expect(detectOptSignal(null)).toBeNull();
    expect(detectOptSignal(undefined)).toBeNull();
    expect(detectOptSignal('   ')).toBeNull();
  });

  it('ignores media placeholders the webhook writes as content', () => {
    for (const t of ['[Image]', '[Audio]', '[Document: bill.pdf]', '[Sticker]']) {
      expect(detectOptSignal(t), t).toBeNull();
    }
  });

  it('ignores anything long enough to be a real sentence', () => {
    expect(
      detectOptSignal('stop stop stop stop stop stop stop stop stop stop stop')
    ).toBeNull();
  });
});

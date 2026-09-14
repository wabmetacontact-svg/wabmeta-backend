// Kaunsa review kis status se chalega - yahi rule tay karta hai ki admin
// rejected request ko wapas approve kar sake, aur approved wallet galti se
// "rejected" label ke peeche na chhup jaye.

import { describe, it, expect } from 'vitest';
import { canReview, reviewBlockedMessage, defaultReviewNote } from './wallet.review';

describe('canReview', () => {
  it('pending ko approve aur reject dono kar sakte hain', () => {
    expect(canReview('pending', 'approve')).toBe(true);
    expect(canReview('pending', 'reject')).toBe(true);
  });

  it('rejected ko baad me approve kar sakte hain', () => {
    expect(canReview('rejected', 'approve')).toBe(true);
  });

  it('rejected ko dobara reject nahi', () => {
    expect(canReview('rejected', 'reject')).toBe(false);
  });

  it('approved ko reject nahi - chalu wallet jhoothe label ke peeche chhup jata', () => {
    expect(canReview('approved', 'reject')).toBe(false);
  });

  it('approved ko dobara approve nahi', () => {
    expect(canReview('approved', 'approve')).toBe(false);
  });

  it('anjaan status par kuch allowed nahi', () => {
    expect(canReview('cancelled', 'approve')).toBe(false);
    expect(canReview('', 'reject')).toBe(false);
  });
});

describe('reviewBlockedMessage', () => {
  it('approved ko reject karne par Active Wallets ka rasta batata hai', () => {
    expect(reviewBlockedMessage('approved', 'reject')).toContain('Active Wallets');
  });

  it('dohraye gaye action par saaf batata hai', () => {
    expect(reviewBlockedMessage('approved', 'approve')).toContain('already approved');
    expect(reviewBlockedMessage('rejected', 'reject')).toContain('already rejected');
  });
});

describe('defaultReviewNote', () => {
  it('rejection palatne par wo baat note me aati hai', () => {
    expect(defaultReviewNote('rejected', 'approve')).toBe('Approved after an earlier rejection');
  });

  it('pending par sadharan note', () => {
    expect(defaultReviewNote('pending', 'approve')).toBe('Admin approved');
    expect(defaultReviewNote('pending', 'reject')).toBe('Admin rejected');
  });
});

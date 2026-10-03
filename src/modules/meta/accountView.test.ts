// What the account card receives: the business verification it shows, and a
// status that follows Meta's name approval.

import { describe, it, expect } from 'vitest';
import { toClientAccount } from './accountView';

const limitedForName = {
  entities: [
    {
      entity_type: 'PHONE_NUMBER',
      can_send_message: 'LIMITED',
      additional_info: ['Your display name has not been approved yet. Your message limit will increase after the display name is approved.'],
    },
  ],
};

describe('toClientAccount', () => {
  it('passes business verification through and keeps secrets out', () => {
    const a = toClientAccount({ id: 'a1', accessToken: 'secret', businessVerificationStatus: 'verified', codeVerificationStatus: 'EXPIRED' })!;
    expect(a.businessVerificationStatus).toBe('verified');
    expect(a.accessToken).toBeUndefined();
    expect(a.hasAccessToken).toBe(true);
  });

  it("shows the admin's verification override as the business verification", () => {
    const a = toClientAccount({ id: 'a1', businessVerificationStatus: 'pending', codeVerificationOverride: 'VERIFIED' })!;
    expect(a.businessVerificationStatus).toBe('verified');
  });

  it('is "Limited" for low quality, not for the display-name note', () => {
    const nameOnly = toClientAccount({ id: 'a1', healthCanSend: 'LIMITED', healthStatus: limitedForName, nameStatus: 'PENDING_REVIEW', qualityRating: 'GREEN' })!;
    expect(nameOnly.displayState).toBe('CONNECTED');

    const low = toClientAccount({ id: 'a1', healthCanSend: 'AVAILABLE', qualityRating: 'RED' })!;
    expect(low.displayState).toBe('LIMITED');
    expect(low.displayIssue.title).toBe('Quality is low');

    // The admin's quality override is what the card shows, so the pill follows it
    const overridden = toClientAccount({ id: 'a1', healthCanSend: 'AVAILABLE', qualityRating: 'RED', qualityRatingOverride: 'GREEN' })!;
    expect(overridden.displayState).toBe('CONNECTED');
  });
});

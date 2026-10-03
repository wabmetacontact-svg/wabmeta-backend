// This decides whether a customer is told their account is banned. Getting it
// wrong in one direction frightens a customer whose card was declined; in the
// other, it hides a real ban behind a friendly "action needed". Both cases
// are pinned here.

import { describe, it, expect } from 'vitest';
import { displayStateFor, WABA_BANNED_CODE } from './healthDisplay';

const wabaError = (code: number, description = 'desc', solution?: string) => ({
  can_send_message: 'BLOCKED',
  entities: [
    { entity_type: 'PHONE_NUMBER', can_send_message: 'AVAILABLE' },
    {
      entity_type: 'WABA',
      can_send_message: 'BLOCKED',
      errors: [{ error_code: code, error_description: description, possible_solution: solution }],
    },
  ],
});

describe('a payment problem is not a ban', () => {
  it('shows ACTION_NEEDED with a "Payment issue" badge for 141006', () => {
    const r = displayStateFor({
      canSend: 'BLOCKED',
      raw: wabaError(141006, 'There is an error with the payment method.', 'Please add a new payment method.'),
    });
    expect(r.state).toBe('ACTION_NEEDED');
    expect(r.issue?.badge).toBe('Payment issue');
    expect(r.issue?.entity).toBe('WABA');
    expect(r.issue?.code).toBe(141006);
    expect(r.issue?.action).toContain('Billing & payments');
    expect(r.issue?.metaSays).toContain('payment method');
  });

  it('shows "Verification needed" for 141010', () => {
    const r = displayStateFor({ canSend: 'BLOCKED', raw: wabaError(141010) });
    expect(r.state).toBe('ACTION_NEEDED');
    expect(r.issue?.badge).toBe('Verification needed');
  });

  it('never calls an unexplained block a ban', () => {
    const r = displayStateFor({ canSend: 'BLOCKED', raw: wabaError(999001, 'Something new') });
    expect(r.state).toBe('ACTION_NEEDED');
    expect(r.issue?.badge).toBe('Action needed');
    expect(r.issue?.metaSays).toContain('Something new');
  });

  it('still says ACTION_NEEDED when Meta gave no detail at all', () => {
    const r = displayStateFor({ canSend: 'BLOCKED', raw: null });
    expect(r.state).toBe('ACTION_NEEDED');
    expect(r.issue?.code).toBeNull();
  });
});

describe('a real ban is shown as a ban', () => {
  it('shows BANNED for the WABA-banned code', () => {
    const r = displayStateFor({ canSend: 'BLOCKED', raw: wabaError(WABA_BANNED_CODE) });
    expect(r.state).toBe('BANNED');
    expect(r.issue?.badge).toBe('Banned');
    expect(r.issue?.action).toContain('review');
  });

  it('a ban outranks a payment problem reported alongside it', () => {
    const raw = {
      entities: [
        {
          entity_type: 'WABA',
          can_send_message: 'BLOCKED',
          errors: [
            { error_code: 141006, error_description: 'payment' },
            { error_code: WABA_BANNED_CODE, error_description: 'banned' },
          ],
        },
      ],
    };
    expect(displayStateFor({ canSend: 'BLOCKED', raw }).state).toBe('BANNED');
  });

  it('an admin override of BAN wins', () => {
    const r = displayStateFor({ override: 'BAN', canSend: 'AVAILABLE' });
    expect(r.state).toBe('BANNED');
    expect(r.issue?.entity).toBe('ADMIN');
  });
});

describe('the other states', () => {
  it('AVAILABLE is CONNECTED with nothing to warn about', () => {
    expect(displayStateFor({ canSend: 'AVAILABLE', raw: { entities: [] } })).toEqual({
      state: 'CONNECTED',
      issue: null,
    });
  });

  it('never checked is CONNECTED, not a scare', () => {
    expect(displayStateFor({ canSend: null, raw: null }).state).toBe('CONNECTED');
  });

  it('LIMITED explains a quality throttle', () => {
    const raw = {
      entities: [
        {
          entity_type: 'PHONE_NUMBER',
          can_send_message: 'LIMITED',
          errors: [{ error_code: 131049, error_description: 'throttled' }],
        },
      ],
    };
    const r = displayStateFor({ canSend: 'LIMITED', raw });
    expect(r.state).toBe('LIMITED');
    expect(r.issue?.title).toBe('Throttled for quality');
  });

  it('LIMITED with only an info note uses the note', () => {
    const raw = {
      entities: [
        {
          entity_type: 'PHONE_NUMBER',
          can_send_message: 'LIMITED',
          additional_info: ['Display name is not approved yet'],
        },
      ],
    };
    const r = displayStateFor({ canSend: 'LIMITED', raw });
    expect(r.issue?.action).toBe('Display name is not approved yet');
  });

  it('admin overrides of BLOCKED and CONNECTED are respected', () => {
    expect(displayStateFor({ override: 'BLOCKED', canSend: 'AVAILABLE' }).state).toBe('ACTION_NEEDED');
    expect(displayStateFor({ override: 'CONNECTED', canSend: 'BLOCKED', raw: wabaError(141006) }).state)
      .toBe('CONNECTED');
  });
});

describe("Meta's display-name note on a LIMITED number", () => {
  // Meta's own example of a LIMITED phone number
  const nameNotApproved = {
    can_send_message: 'LIMITED',
    entities: [
      {
        entity_type: 'PHONE_NUMBER',
        can_send_message: 'LIMITED',
        additional_info: [
          'Your display name has not been approved yet. Your message limit will increase after the display name is approved.',
        ],
      },
      { entity_type: 'WABA', can_send_message: 'AVAILABLE' },
    ],
  };

  it('is shown while the name is not approved', () => {
    for (const nameStatus of ['PENDING_REVIEW', 'AVAILABLE_WITHOUT_REVIEW', 'DECLINED', null]) {
      const r = displayStateFor({ canSend: 'LIMITED', raw: nameNotApproved, nameStatus });
      expect(r.state).toBe('LIMITED');
      expect(r.issue?.action).toContain('display name has not been approved');
    }
  });

  it('is dropped once Meta reports the name APPROVED', () => {
    const r = displayStateFor({ canSend: 'LIMITED', raw: nameNotApproved, nameStatus: 'APPROVED' });
    expect(r).toEqual({ state: 'CONNECTED', issue: null });
  });

  it('does not hide any other limit on an approved name', () => {
    const throttled = {
      ...nameNotApproved,
      entities: [
        {
          ...nameNotApproved.entities[0],
          errors: [{ error_code: 131049, error_description: 'Throttled' }],
        },
      ],
    };
    expect(displayStateFor({ canSend: 'LIMITED', raw: throttled, nameStatus: 'APPROVED' }).state).toBe('LIMITED');

    const otherNote = {
      ...nameNotApproved,
      entities: [{ ...nameNotApproved.entities[0], additional_info: ['Some other limit.'] }],
    };
    expect(displayStateFor({ canSend: 'LIMITED', raw: otherNote, nameStatus: 'APPROVED' }).state).toBe('LIMITED');
  });
});

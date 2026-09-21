// Support reads this to tell a client exactly what to fix. If a level or an
// error code goes missing here, the admin panel tells the client the wrong
// thing - or nothing - while their templates keep failing.

import { describe, it, expect } from 'vitest';
import { describeHealth, KNOWN_HEALTH_CODES } from './accountHealth.service';

// The shape Meta returned for the account in the support screenshot:
// phone number fine, WABA blocked for a payment method problem.
const paymentBlocked = {
  can_send_message: 'BLOCKED',
  entities: [
    { entity_type: 'PHONE_NUMBER', id: '111', can_send_message: 'AVAILABLE' },
    {
      entity_type: 'WABA',
      id: '222',
      can_send_message: 'BLOCKED',
      errors: [
        {
          error_code: 141006,
          error_description:
            'There is an error with the payment method. This will block business initiated conversations.',
          possible_solution:
            'There was an error with your payment method. Please add a new payment method to the account.',
        },
      ],
    },
    { entity_type: 'BUSINESS', id: '333', can_send_message: 'AVAILABLE' },
    { entity_type: 'APP', id: '444', can_send_message: 'AVAILABLE' },
  ],
};

describe('describeHealth', () => {
  it('keeps every level Meta checked, not just the first problem', () => {
    const rows = describeHealth(paymentBlocked);
    expect(rows.map((r) => r.entity)).toEqual(['PHONE_NUMBER', 'WABA', 'BUSINESS', 'APP']);
    expect(rows.map((r) => r.canSend)).toEqual(['AVAILABLE', 'BLOCKED', 'AVAILABLE', 'AVAILABLE']);
  });

  it('puts the error on the level it belongs to', () => {
    const waba = describeHealth(paymentBlocked).find((r) => r.entity === 'WABA')!;
    expect(waba.errors).toHaveLength(1);
    expect(waba.errors[0].code).toBe(141006);
    expect(waba.errors[0].solution).toContain('payment method');
  });

  it('attaches the client-ready explanation for a known code', () => {
    const waba = describeHealth(paymentBlocked).find((r) => r.entity === 'WABA')!;
    expect(waba.errors[0].known?.title).toBe('Payment method problem');
    expect(waba.errors[0].known?.action).toContain('Billing & payments');
  });

  it('leaves an unknown code with Meta\'s own words and no invented advice', () => {
    const rows = describeHealth({
      entities: [
        {
          entity_type: 'WABA',
          can_send_message: 'LIMITED',
          errors: [{ error_code: 999999, error_description: 'Something new' }],
        },
      ],
    });
    expect(rows[0].errors[0].description).toBe('Something new');
    expect(rows[0].errors[0].known).toBeNull();
  });

  it('drops the calling-only codes that do not affect messaging', () => {
    const rows = describeHealth({
      entities: [
        {
          entity_type: 'PHONE_NUMBER',
          can_send_message: 'AVAILABLE',
          errors: [{ error_code: 138024, error_description: 'Calling not enabled' }],
        },
      ],
    });
    expect(rows[0].errors).toEqual([]);
  });

  it('keeps additional_info notes', () => {
    const rows = describeHealth({
      entities: [
        {
          entity_type: 'PHONE_NUMBER',
          can_send_message: 'LIMITED',
          additional_info: ['Display name not approved yet', ''],
        },
      ],
    });
    expect(rows[0].info).toEqual(['Display name not approved yet']);
  });

  it('copes with nothing stored yet', () => {
    expect(describeHealth(null)).toEqual([]);
    expect(describeHealth({})).toEqual([]);
    expect(describeHealth({ entities: 'nonsense' })).toEqual([]);
  });
});

describe('KNOWN_HEALTH_CODES', () => {
  it('covers the codes Meta sends for the common blocks', () => {
    for (const code of [141006, 141010, 141014, 131049, 130497]) {
      expect(KNOWN_HEALTH_CODES[code], String(code)).toBeDefined();
      expect(KNOWN_HEALTH_CODES[code].action.length).toBeGreaterThan(20);
    }
  });
});

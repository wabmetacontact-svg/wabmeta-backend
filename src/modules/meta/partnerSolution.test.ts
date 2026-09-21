// Whether a client is on the Solution Partner's credit line decides whose
// money their messages are spent from. The parser must never invent a
// confirmation from a payload it does not understand, and never miss the one
// shape it does.

import { describe, it, expect } from 'vitest';
import { isMetaId, parsePartnerAdded } from './partnerSolution';

describe('isMetaId', () => {
  it('accepts Meta-style numeric ids', () => {
    expect(isMetaId('102290129340398')).toBe(true);
    expect(isMetaId(' 102290129340398 ')).toBe(true);
  });

  it('rejects anything that is not one', () => {
    expect(isMetaId('')).toBe(false);
    expect(isMetaId('abc123')).toBe(false);
    expect(isMetaId('123')).toBe(false); // too short to be a real id
    expect(isMetaId(102290129340398 as any)).toBe(false); // numbers lose precision
    expect(isMetaId(undefined)).toBe(false);
    expect(isMetaId('1; DROP TABLE')).toBe(false);
  });
});

describe('parsePartnerAdded', () => {
  const wabaInfo = {
    waba_id: '102290129340398',
    solution_id: '58501441721238',
    owner_business_id: '2729063490586005',
  };

  it('reads the documented waba_info shape', () => {
    expect(parsePartnerAdded({ event: 'PARTNER_ADDED', waba_info: wabaInfo })).toEqual({
      wabaId: '102290129340398',
      solutionId: '58501441721238',
      ownerBusinessId: '2729063490586005',
    });
  });

  it('also reads the fields flat on the value', () => {
    expect(parsePartnerAdded({ event: 'PARTNER_ADDED', ...wabaInfo })?.solutionId)
      .toBe('58501441721238');
  });

  it('ignores every other account_update event', () => {
    expect(parsePartnerAdded({ event: 'VERIFIED_ACCOUNT', waba_info: wabaInfo })).toBeNull();
    expect(parsePartnerAdded({ event: 'DISABLED_UPDATE', waba_info: wabaInfo })).toBeNull();
    expect(parsePartnerAdded({ waba_info: wabaInfo })).toBeNull();
  });

  it('ignores a payload with no usable WABA id', () => {
    expect(parsePartnerAdded({ event: 'PARTNER_ADDED', waba_info: {} })).toBeNull();
    expect(
      parsePartnerAdded({ event: 'PARTNER_ADDED', waba_info: { waba_id: 'nope' } })
    ).toBeNull();
    expect(parsePartnerAdded(null)).toBeNull();
    expect(parsePartnerAdded(undefined)).toBeNull();
  });

  it('keeps the WABA but reports no solution when Meta sent none', () => {
    // A partner added without a solution is not on a shared credit line.
    const parsed = parsePartnerAdded({
      event: 'PARTNER_ADDED',
      waba_info: { waba_id: '102290129340398' },
    });
    expect(parsed?.wabaId).toBe('102290129340398');
    expect(parsed?.solutionId).toBeNull();
  });

  it('is not fooled by case', () => {
    expect(parsePartnerAdded({ event: 'partner_added', waba_info: wabaInfo })?.wabaId)
      .toBe('102290129340398');
  });
});

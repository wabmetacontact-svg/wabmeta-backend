// WhatsApp Calling, the pure parts: reading Meta's webhooks (payloads as in
// developers.facebook.com/docs/whatsapp/cloud-api/calling), how a call ends,
// and whether a number may use calling.

import { describe, it, expect } from 'vitest';
import { callingEligibility, parseCallsWebhook, terminalStatus } from './calling.service';
import { callPermissionReplyText } from '../webhooks/webhook.service';

const CALL = 'wacid.HBgLMTIxODU1NTI4MjgVAgARGCAyODRQIAFRoA';

describe('parseCallsWebhook', () => {
  it("reads a customer's call with its SDP offer", () => {
    expect(
      parseCallsWebhook({
        metadata: { phone_number_id: 'pn1' },
        calls: [{
          id: CALL, from: '919812345678', to: '919900000000', event: 'connect',
          direction: 'USER_INITIATED', timestamp: '1749197000',
          session: { sdp_type: 'offer', sdp: 'v=0\r\no=- 1 2 IN IP4 127.0.0.1' },
        }],
      })
    ).toEqual([{
      kind: 'connect', callId: CALL, direction: 'USER_INITIATED', from: '919812345678', to: '919900000000',
      sdpType: 'offer', sdp: 'v=0\r\no=- 1 2 IN IP4 127.0.0.1',
    }]);
  });

  it('reads the SDP answer to our call and its RINGING / ACCEPTED / REJECTED statuses', () => {
    const events = parseCallsWebhook({
      calls: [{ id: CALL, to: '12185552828', from: '13175551399', event: 'connect', direction: 'BUSINESS_INITIATED', session: { sdp_type: 'answer', sdp: 'v=0 answer' } }],
      statuses: [
        { id: CALL, type: 'call', status: 'RINGING', timestamp: '1749197000', recipient_id: '12185552828' },
        { id: 'wamid.x', type: 'message', status: 'delivered' }, // not a call
      ],
    });
    expect(events).toEqual([
      { kind: 'connect', callId: CALL, direction: 'BUSINESS_INITIATED', from: '13175551399', to: '12185552828', sdpType: 'answer', sdp: 'v=0 answer' },
      { kind: 'status', callId: CALL, status: 'RINGING', recipientId: '12185552828' },
    ]);
  });

  it('reads the end of a call with its duration', () => {
    expect(parseCallsWebhook({
      calls: [{ id: CALL, to: '1', from: '2', event: 'terminate', direction: 'BUSINESS_INITIATED', status: 'Completed', start_time: '1671644824', end_time: '1671644944', duration: 480 }],
    })).toEqual([{ kind: 'terminate', callId: CALL, direction: 'BUSINESS_INITIATED', from: '2', to: '1', metaStatus: 'Completed', duration: 480 }]);
  });

  it('ignores the old guessed shape and empty payloads', () => {
    expect(parseCallsWebhook({ call: { id: CALL, direction: 'inbound' } })).toEqual([]);
    expect(parseCallsWebhook(undefined)).toEqual([]);
  });
});

describe('terminalStatus', () => {
  it('an answered call is completed', () => {
    expect(terminalStatus('ANSWERED', 'INBOUND', true)).toBe('COMPLETED');
    expect(terminalStatus('ANSWERED', 'OUTBOUND', true, 'Completed')).toBe('COMPLETED');
  });
  it("a customer's call nobody answered is missed; a declined one stays declined", () => {
    expect(terminalStatus('RINGING', 'INBOUND', false, 'Failed')).toBe('MISSED');
    expect(terminalStatus('REJECTED', 'INBOUND', false)).toBe('REJECTED');
  });
  it('our unanswered call is not answered, or failed if it never rang', () => {
    expect(terminalStatus('RINGING', 'OUTBOUND', false, 'Failed')).toBe('NOT_ANSWERED');
    expect(terminalStatus('CALLING', 'OUTBOUND', false, 'Failed')).toBe('FAILED');
  });
});

describe('callingEligibility', () => {
  it('needs a daily messaging limit of at least 2,000', () => {
    expect(callingEligibility({ messagingLimit: 'TIER_1K', phoneNumber: '+91 99000 00000' }).meetsLimit).toBe(false);
    expect(callingEligibility({ messagingLimit: 'TIER_2K', phoneNumber: '+919900000000' }).meetsLimit).toBe(true);
    expect(callingEligibility({ messagingLimit: 'TIER_UNLIMITED', phoneNumber: '919900000000' }).meetsLimit).toBe(true);
    expect(callingEligibility({ messagingLimit: null, phoneNumber: '919900000000' }).meetsLimit).toBeNull();
  });
  it('blocks calling customers from US/Canada, Egypt, Vietnam and Nigeria numbers only', () => {
    expect(callingEligibility({ messagingLimit: 'TIER_10K', phoneNumber: '+1 415 555 0100' }).outboundAvailable).toBe(false);
    expect(callingEligibility({ messagingLimit: 'TIER_10K', phoneNumber: '+234 803 000 0000' }).outboundAvailable).toBe(false);
    expect(callingEligibility({ messagingLimit: 'TIER_10K', phoneNumber: '+91 99000 00000' }).outboundAvailable).toBe(true);
  });
});

describe('callPermissionReplyText', () => {
  it("puts the customer's answer in words", () => {
    expect(callPermissionReplyText({ response: 'accept', is_permanent: true })).toBe('📞 Allowed calls from your business');
    expect(callPermissionReplyText({ response: 'reject' })).toBe('📵 Declined calls from your business');
    expect(callPermissionReplyText({ response: 'accept', is_permanent: false, expiration_timestamp: '1768550400' })).toMatch(/^📞 Allowed calls until /);
  });
});

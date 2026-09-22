// Media trigger, buttons payload and webhook URL rules.

import { describe, it, expect } from 'vitest';
import {
  assertSafeWebhookUrl,
  buildButtonsPayload,
  isPrivateAddress,
  mediaTriggerMatches,
} from './automation.media';

describe('mediaTriggerMatches', () => {
  it('defaults to image and video', () => {
    expect(mediaTriggerMatches({}, { type: 'IMAGE' })).toBe(true);
    expect(mediaTriggerMatches(null, { type: 'VIDEO' })).toBe(true);
    expect(mediaTriggerMatches({}, { type: 'DOCUMENT' })).toBe(false);
    expect(mediaTriggerMatches({}, { type: 'AUDIO' })).toBe(false);
  });

  it('follows the chosen media types, in any case', () => {
    expect(mediaTriggerMatches({ mediaTypes: ['document'] }, { type: 'DOCUMENT' })).toBe(true);
    expect(mediaTriggerMatches({ mediaTypes: ['VIDEO'] }, { type: 'IMAGE' })).toBe(false);
  });

  it('with caption words, needs one of them in the caption', () => {
    const config = { captionKeywords: ['Payment', ' receipt '] };
    expect(mediaTriggerMatches(config, { type: 'IMAGE', caption: 'here is my payment screenshot' })).toBe(true);
    expect(mediaTriggerMatches(config, { type: 'IMAGE', caption: 'RECEIPT attached' })).toBe(true);
    expect(mediaTriggerMatches(config, { type: 'IMAGE', caption: 'hello' })).toBe(false);
    expect(mediaTriggerMatches(config, { type: 'IMAGE' })).toBe(false);
    expect(mediaTriggerMatches({ captionKeywords: ['', '  '] }, { type: 'IMAGE' })).toBe(true);
  });
});

describe('buildButtonsPayload', () => {
  it('builds up to three quick replies from what the builder saves', () => {
    const r: any = buildButtonsPayload(
      { buttons: [{ id: 'yes', text: 'Yes' }, { text: 'No' }, { title: 'Later' }, { text: 'Fourth' }], footer: 'WabMeta' },
      'Book a demo?'
    );
    expect(r.interactive.type).toBe('button');
    expect(r.interactive.body.text).toBe('Book a demo?');
    expect(r.interactive.footer.text).toBe('WabMeta');
    expect(r.interactive.action.buttons.map((b: any) => b.reply)).toEqual([
      { id: 'yes', title: 'Yes' },
      { id: 'btn_2', title: 'No' },
      { id: 'btn_3', title: 'Later' },
    ]);
  });

  it('cuts titles to 20 characters', () => {
    const r: any = buildButtonsPayload({ buttons: [{ text: 'A very long button title here' }] }, 'x');
    expect(r.interactive.action.buttons[0].reply.title).toHaveLength(20);
  });

  it('builds one link button', () => {
    const r: any = buildButtonsPayload({ mode: 'url', url: 'https://wabmeta.com/pay', urlText: 'Pay now', header: 'Invoice' }, 'Your bill');
    expect(r.interactive).toEqual({
      type: 'cta_url',
      body: { text: 'Your bill' },
      header: { type: 'text', text: 'Invoice' },
      action: { name: 'cta_url', parameters: { display_text: 'Pay now', url: 'https://wabmeta.com/pay' } },
    });
  });

  it('says what is wrong instead of sending nothing', () => {
    expect(buildButtonsPayload({ buttons: [] }, 'x')).toEqual({ error: 'Add at least one button' });
    expect(buildButtonsPayload({ buttons: [{ text: '  ' }] }, 'x')).toEqual({ error: 'Add at least one button' });
    expect(buildButtonsPayload({ buttons: [{ text: 'Yes' }, { text: 'yes' }] }, 'x')).toEqual({ error: 'Two buttons have the same text' });
    expect(buildButtonsPayload({ mode: 'url', url: 'wabmeta.com' }, 'x')).toMatchObject({ error: expect.stringMatching(/http/) });
    expect(buildButtonsPayload({ buttons: [{ text: 'Yes' }] }, '   ')).toEqual({ error: 'The message text is empty' });
  });
});

describe('webhook URL safety', () => {
  it('knows private and internal addresses', () => {
    for (const ip of ['127.0.0.1', '10.1.2.3', '172.16.0.1', '192.168.1.1', '169.254.169.254', '0.0.0.0', '100.64.0.1', '::1', 'fd00::1', 'fe80::1', '::ffff:10.0.0.1']) {
      expect(isPrivateAddress(ip)).toBe(true);
    }
    for (const ip of ['8.8.8.8', '1.1.1.1', '172.32.0.1', '2606:4700::1111']) {
      expect(isPrivateAddress(ip)).toBe(false);
    }
  });

  it('refuses internal, odd-scheme and credentialed URLs', async () => {
    await expect(assertSafeWebhookUrl('http://127.0.0.1:10000/api')).rejects.toThrow(/private/);
    await expect(assertSafeWebhookUrl('http://169.254.169.254/latest/meta-data')).rejects.toThrow(/private/);
    await expect(assertSafeWebhookUrl('http://[::1]/x')).rejects.toThrow(/private/);
    await expect(assertSafeWebhookUrl('ftp://example.com')).rejects.toThrow(/http/);
    await expect(assertSafeWebhookUrl('https://user:pw@8.8.8.8/')).rejects.toThrow(/password/);
    await expect(assertSafeWebhookUrl('not a url')).rejects.toThrow(/valid/);
  });

  it('allows a public address', async () => {
    const u = await assertSafeWebhookUrl('https://8.8.8.8/hook');
    expect(u.hostname).toBe('8.8.8.8');
  });
});

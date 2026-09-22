// src/modules/automation/automation.media.ts
//
// Pure rules for three automation pieces:
//   - the MEDIA_RECEIVED trigger (which incoming media starts an automation)
//   - the send_buttons action (a WhatsApp interactive message: up to three
//     quick-reply buttons, or one link button)
//   - the webhook action (which URLs an automation may call)

import dns from 'dns/promises';
import net from 'net';

// ─── MEDIA_RECEIVED ────────────────────────────────────────────────────────

export const MEDIA_TYPES = ['IMAGE', 'VIDEO', 'DOCUMENT', 'AUDIO'] as const;
export type MediaType = (typeof MEDIA_TYPES)[number];

export const isMediaType = (v: unknown): v is MediaType =>
  typeof v === 'string' && (MEDIA_TYPES as readonly string[]).includes(v.toUpperCase());

/**
 * Does this incoming media start the automation?
 *
 * mediaTypes empty or missing means image and video - what the trigger is
 * named for. captionKeywords, when set, need at least one of them in the
 * caption (case-insensitive); a media with no caption then does not match.
 */
export const mediaTriggerMatches = (
  config: { mediaTypes?: unknown; captionKeywords?: unknown } | null | undefined,
  media: { type: string; caption?: string | null }
): boolean => {
  const type = String(media.type || '').toUpperCase();
  const wanted = Array.isArray(config?.mediaTypes) && config!.mediaTypes.length
    ? (config!.mediaTypes as unknown[]).map((t) => String(t).toUpperCase())
    : ['IMAGE', 'VIDEO'];
  if (!wanted.includes(type)) return false;

  const keywords = Array.isArray(config?.captionKeywords)
    ? (config!.captionKeywords as unknown[]).map((k) => String(k).trim().toLowerCase()).filter(Boolean)
    : [];
  if (keywords.length === 0) return true;

  const caption = String(media.caption || '').toLowerCase();
  return keywords.some((k) => caption.includes(k));
};

// ─── send_buttons ──────────────────────────────────────────────────────────

// WhatsApp's limits for interactive messages.
const LIMITS = { body: 1024, header: 60, footer: 60, buttonTitle: 20, buttonId: 256, maxReplyButtons: 3 };

const clip = (s: unknown, n: number) => String(s ?? '').trim().slice(0, n);

export interface ButtonsConfig {
  /** 'reply' = up to three quick-reply buttons; 'url' = one link button. */
  mode?: 'reply' | 'url';
  text?: string;
  header?: string;
  footer?: string;
  /** Quick replies. `text` is what the builder saves; `title` is accepted too. */
  buttons?: { id?: string; text?: string; title?: string }[];
  /** Link button. */
  url?: string;
  urlText?: string;
}

/**
 * The `interactive` object for a buttons message, or an error saying what is
 * missing. `body` has already had its variables replaced.
 */
export const buildButtonsPayload = (
  config: ButtonsConfig,
  body: string
): { interactive: any } | { error: string } => {
  const text = clip(body, LIMITS.body);
  if (!text) return { error: 'The message text is empty' };

  const header = clip(config.header, LIMITS.header);
  const footer = clip(config.footer, LIMITS.footer);
  const extras = {
    ...(header && { header: { type: 'text', text: header } }),
    ...(footer && { footer: { text: footer } }),
  };

  if (config.mode === 'url') {
    const url = String(config.url || '').trim();
    if (!/^https?:\/\/\S+$/i.test(url)) return { error: 'The link must start with http:// or https://' };
    const display = clip(config.urlText, LIMITS.buttonTitle) || 'Open link';
    return {
      interactive: {
        type: 'cta_url',
        body: { text },
        ...extras,
        action: { name: 'cta_url', parameters: { display_text: display, url } },
      },
    };
  }

  const buttons = (config.buttons || [])
    .map((b, i) => ({
      id: clip(b.id, LIMITS.buttonId) || `btn_${i + 1}`,
      title: clip(b.text ?? b.title, LIMITS.buttonTitle),
    }))
    .filter((b) => b.title)
    .slice(0, LIMITS.maxReplyButtons);

  if (buttons.length === 0) return { error: 'Add at least one button' };

  // WhatsApp rejects two buttons with the same title or id.
  const titles = new Set(buttons.map((b) => b.title.toLowerCase()));
  if (titles.size !== buttons.length) return { error: 'Two buttons have the same text' };
  const ids = new Set(buttons.map((b) => b.id));
  if (ids.size !== buttons.length) buttons.forEach((b, i) => (b.id = `btn_${i + 1}`));

  return {
    interactive: {
      type: 'button',
      body: { text },
      ...extras,
      action: { buttons: buttons.map((b) => ({ type: 'reply', reply: { id: b.id, title: b.title } })) },
    },
  };
};

// ─── webhook ───────────────────────────────────────────────────────────────

/** Loopback, private, link-local and other addresses a webhook must never reach. */
export const isPrivateAddress = (ip: string): boolean => {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split('.').map(Number);
    return (
      a === 0 || a === 10 || a === 127 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      a >= 224
    );
  }
  const v6 = ip.toLowerCase();
  if (v6 === '::1' || v6 === '::') return true;
  if (v6.startsWith('fc') || v6.startsWith('fd') || v6.startsWith('fe80')) return true;
  const mapped = v6.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  return mapped ? isPrivateAddress(mapped[1]) : false;
};

/**
 * Refuse a webhook URL that is not http(s) or that resolves to an internal
 * address - otherwise a customer could point an automation at our own
 * servers or cloud metadata endpoints.
 */
export const assertSafeWebhookUrl = async (raw: string): Promise<URL> => {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error('Webhook URL is not a valid URL');
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') throw new Error('Webhook URL must be http or https');
  if (url.username || url.password) throw new Error('Webhook URL must not contain a username or password');

  const host = url.hostname.replace(/^\[|\]$/g, '');
  const addresses = net.isIP(host) ? [host] : (await dns.lookup(host, { all: true })).map((a) => a.address);
  if (addresses.length === 0 || addresses.some(isPrivateAddress)) {
    throw new Error('Webhook URL points to a private or internal address');
  }
  return url;
};

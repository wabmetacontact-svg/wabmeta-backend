// src/modules/meta/healthDisplay.ts
//
// Turning Meta's health_status into something a customer can act on.
//
// Pure functions only - no database, no Meta calls - so the account payload,
// the admin panel and the tests all read Meta's answer the same way.
//
// The distinction that matters most: Meta reports a payment problem and a
// banned account with the same can_send_message: BLOCKED. To a customer those
// are opposite situations - one is fixed by adding a card in two minutes, the
// other may be permanent. Showing both as "Blocked" frightened customers
// whose only problem was a declined card.

export type HealthLevel = 'AVAILABLE' | 'LIMITED' | 'BLOCKED' | 'UNKNOWN';

// Calling/SIP errors only affect voice. Showing them alarms people about
// messaging for no reason.
export const IGNORED_CODES = new Set([138024, 138025, 138026]);

export function normalise(level: any): HealthLevel {
  const v = String(level || '').toUpperCase();
  if (v === 'AVAILABLE' || v === 'LIMITED' || v === 'BLOCKED') return v;
  return 'UNKNOWN';
}

/** Meta's code for "this WhatsApp Business Account is banned". */
export const WABA_BANNED_CODE = 141014;

/**
 * The codes Meta sends most, in words a customer can act on.
 *
 * `badge` is the short label for the status pill; `action` is the next step,
 * written so it reads correctly whether the customer sees it or support reads
 * it out to them. Codes not listed fall back to Meta's own text.
 */
export const KNOWN_HEALTH_CODES: Record<
  number,
  { badge: string; title: string; action: string }
> = {
  141006: {
    badge: 'Payment issue',
    title: 'Payment method problem',
    action:
      'Your WhatsApp Business Account has no working payment method. In Meta ' +
      'Business Suite > Billing & payments > WhatsApp Business accounts, select ' +
      'this account and set a card as default. If a card is already there, pay ' +
      'any outstanding balance and make sure your bank allows international and ' +
      'online transactions - Indian cards often decline Meta by default.',
  },
  141010: {
    badge: 'Verification needed',
    title: 'Business verification not complete',
    action:
      'Complete business verification in Meta Business Suite > Settings > ' +
      'Security Center. Templates and campaigns stay paused until Meta approves it.',
  },
  [WABA_BANNED_CODE]: {
    badge: 'Banned',
    title: 'WhatsApp Business Account banned',
    action:
      'Meta has disabled this account for a policy violation. You can request a ' +
      'review in WhatsApp Manager > Account quality. Only Meta can lift a ban.',
  },
  131049: {
    badge: 'Limited',
    title: 'Throttled for quality',
    action:
      'Meta is limiting marketing messages to protect users - usually after ' +
      'blocks or reports. Send fewer marketing templates, only to contacts who ' +
      'opted in; it recovers as quality improves.',
  },
  130497: {
    badge: 'Limited',
    title: 'Throttled for quality',
    action:
      'Meta is limiting what this number can send. Reduce volume and send only ' +
      'to opted-in contacts; it recovers as quality improves.',
  },
};

export interface HealthEntity {
  /** PHONE_NUMBER | WABA | BUSINESS | APP */
  entity: string;
  id: string | null;
  canSend: HealthLevel;
  errors: Array<{
    code: number | null;
    description: string;
    solution: string | null;
    /** Our plain-language explanation, when the code is one we know. */
    known: { badge: string; title: string; action: string } | null;
  }>;
  info: string[];
}

/**
 * Meta's health_status, one row per level it checked.
 *
 * Meta evaluates the phone number, the WABA, the business portfolio and the
 * app separately, and a block at any one of them stops sending. A summary
 * line only shows the first problem; this keeps every level, so it is visible
 * that - say - the phone is fine and the WABA is not.
 */
export function describeHealth(raw: any): HealthEntity[] {
  const entities = Array.isArray(raw?.entities) ? raw.entities : [];

  return entities.map((e: any) => ({
    entity: String(e?.entity_type || 'UNKNOWN'),
    id: e?.id ? String(e.id) : null,
    canSend: normalise(e?.can_send_message),
    errors: (Array.isArray(e?.errors) ? e.errors : [])
      .filter((err: any) => !IGNORED_CODES.has(Number(err?.error_code)))
      .map((err: any) => {
        const code = Number(err?.error_code) || null;
        return {
          code,
          description: String(err?.error_description || '').trim(),
          solution: err?.possible_solution ? String(err.possible_solution).trim() : null,
          known: code ? KNOWN_HEALTH_CODES[code] || null : null,
        };
      }),
    info: (Array.isArray(e?.additional_info) ? e.additional_info : [])
      .map((x: any) => String(x || '').trim())
      .filter(Boolean),
  }));
}

// ─── What the customer sees ────────────────────────────────────────────────

/**
 * CONNECTED      Meta lets the number send everything.
 * LIMITED        It can send, but Meta is throttling it.
 * ACTION_NEEDED  Templates and campaigns are stopped by something the
 *                customer can fix - a card, verification. Replies still work.
 * BANNED         Meta has banned the WABA. Only a Meta review can undo it.
 */
export type DisplayState = 'CONNECTED' | 'LIMITED' | 'ACTION_NEEDED' | 'BANNED';

export interface DisplayIssue {
  /** Short text for the status pill: "Payment issue", "Banned". */
  badge: string;
  title: string;
  /** What to do about it. Null when Meta gave no usable detail. */
  action: string | null;
  /** Meta's own wording, for reference. */
  metaSays: string | null;
  code: number | null;
  /** PHONE_NUMBER | WABA | BUSINESS | APP | ADMIN */
  entity: string;
}

/**
 * Decide what the customer's status pill says.
 *
 * Ban is claimed only on evidence: Meta's WABA-banned code, or an admin
 * deliberately setting it. Every other BLOCKED is ACTION_NEEDED - a block we
 * cannot explain is still far more likely to be a card or a form than a ban,
 * and telling a customer they are banned when they are not is the worse
 * mistake.
 */
export function displayStateFor(input: {
  /** healthCanSendOverride: BAN | BLOCKED | CONNECTED, set by an admin. */
  override?: string | null;
  /** healthCanSend as stored from Meta. */
  canSend?: string | null;
  /** healthStatus, Meta's raw response. */
  raw?: any;
}): { state: DisplayState; issue: DisplayIssue | null } {
  // An admin's display override is deliberate and wins.
  const override = String(input.override || '').toUpperCase();
  if (override === 'BAN') {
    return {
      state: 'BANNED',
      issue: {
        badge: 'Banned',
        title: 'Account banned',
        action: KNOWN_HEALTH_CODES[WABA_BANNED_CODE].action,
        metaSays: null,
        code: null,
        entity: 'ADMIN',
      },
    };
  }
  if (override === 'BLOCKED') {
    return {
      state: 'ACTION_NEEDED',
      issue: {
        badge: 'Blocked',
        title: 'Sending is blocked',
        action: 'Contact support for details.',
        metaSays: null,
        code: null,
        entity: 'ADMIN',
      },
    };
  }
  if (override === 'CONNECTED') return { state: 'CONNECTED', issue: null };

  const entities = describeHealth(input.raw);
  const errors = entities.flatMap((e) =>
    e.errors.map((err) => ({ entity: e.entity, err }))
  );

  const toIssue = (
    found: { entity: string; err: HealthEntity['errors'][number] } | undefined,
    fallbackBadge: string,
    fallbackTitle: string
  ): DisplayIssue => ({
    badge: found?.err.known?.badge || fallbackBadge,
    title: found?.err.known?.title || fallbackTitle,
    action:
      found?.err.known?.action ||
      found?.err.solution ||
      null,
    metaSays: found
      ? [found.err.description, found.err.solution].filter(Boolean).join(' ') || null
      : null,
    code: found?.err.code ?? null,
    entity: found?.entity || 'UNKNOWN',
  });

  // A ban outranks everything, on whichever level Meta reports it.
  const banned = errors.find((x) => x.err.code === WABA_BANNED_CODE);
  if (banned) {
    return { state: 'BANNED', issue: toIssue(banned, 'Banned', 'Account banned') };
  }

  const level = normalise(input.canSend);

  if (level === 'BLOCKED') {
    // Prefer an error we can explain, then any error with a code.
    const found =
      errors.find((x) => x.err.known) ||
      errors.find((x) => x.err.code) ||
      errors[0];
    return {
      state: 'ACTION_NEEDED',
      issue: toIssue(found, 'Action needed', 'Templates and campaigns are paused'),
    };
  }

  if (level === 'LIMITED') {
    const found = errors.find((x) => x.err.known) || errors[0];
    const info = entities.flatMap((e) => e.info)[0] || null;
    const issue = toIssue(found, 'Limited', 'Sending is limited');
    return {
      state: 'LIMITED',
      issue: found ? issue : { ...issue, action: info, metaSays: info },
    };
  }

  // AVAILABLE, or never checked - nothing to warn about.
  return { state: 'CONNECTED', issue: null };
}

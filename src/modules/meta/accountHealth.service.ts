// src/modules/meta/accountHealth.service.ts
//
// Meta ka health_status hi ek jagah hai jahan wo saaf batata hai ki koi number
// business-initiated messages (templates, campaigns) bhej sakta hai ya nahi -
// aur na bhej sakne par ASLI wajah kya hai.
//
// Iske bina har rok `(#135000) Generic user error` ban kar aati hai, jisme
// koi wajah likhi hi nahi hoti. Production me is wajah se ghanton lag jate
// the ye samajhne me ki masla payment method ka hai, banned WABA ka hai, ya
// business verification ka.
//
// Meta jo error codes yahan deta hai:
//   141006  payment method me dikkat - business initiated conversations block
//   141010  business verification pass nahi hui
//   141014  WABA banned hai
//   131049 / 130497  quality ki wajah se throttle
//
// health_status char level par aata hai: PHONE_NUMBER, WABA, BUSINESS, APP.
// Inme se koi bhi BLOCKED ho to message nahi jayega.

import prisma from '../../config/database';
import { metaApi } from './meta.api';
import { decrypt } from '../../utils/encryption';

export type HealthLevel = 'AVAILABLE' | 'LIMITED' | 'BLOCKED' | 'UNKNOWN';

export interface HealthIssue {
  entity: string;      // PHONE_NUMBER | WABA | BUSINESS | APP
  code?: number;
  description: string;
  solution?: string;
}

export interface AccountHealth {
  canSend: HealthLevel;
  blocked: boolean;
  /** User ko dikhane layak ek line - Meta ke apne shabdon me */
  summary: string | null;
  issues: HealthIssue[];
  checkedAt: Date;
  /** true = Meta se abhi liya, false = DB se */
  fresh: boolean;
}

// Calling/SIP wale errors sirf voice ke liye hain, messaging par koi asar
// nahi. Inhe dikhane se user bewajah ghabrata hai.
const IGNORED_CODES = new Set([138024, 138025, 138026]);

const CACHE_TTL_MS = 5 * 60 * 1000;

function normalise(level: any): HealthLevel {
  const v = String(level || '').toUpperCase();
  if (v === 'AVAILABLE' || v === 'LIMITED' || v === 'BLOCKED') return v;
  return 'UNKNOWN';
}

function parse(raw: any): { canSend: HealthLevel; issues: HealthIssue[] } {
  const entities = raw?.entities || [];
  const issues: HealthIssue[] = [];
  let worst: HealthLevel = normalise(raw?.can_send_message);

  for (const e of entities) {
    const level = normalise(e?.can_send_message);
    if (level === 'BLOCKED') worst = 'BLOCKED';
    else if (level === 'LIMITED' && worst !== 'BLOCKED') worst = 'LIMITED';

    for (const err of e?.errors || []) {
      if (IGNORED_CODES.has(Number(err?.error_code))) continue;
      issues.push({
        entity: String(e?.entity_type || 'UNKNOWN'),
        code: Number(err?.error_code) || undefined,
        description: String(err?.error_description || '').trim(),
        solution: err?.possible_solution
          ? String(err.possible_solution).trim()
          : undefined,
      });
    }

    // additional_info me Meta wo baatein bhejta hai jo error nahi hain par
    // batani chahiye - jaise "display name abhi approve nahi hua".
    for (const info of e?.additional_info || []) {
      const text = String(info || '').trim();
      if (!text) continue;
      issues.push({ entity: String(e?.entity_type || 'UNKNOWN'), description: text });
    }
  }

  return { canSend: worst, issues };
}

function buildSummary(canSend: HealthLevel, issues: HealthIssue[]): string | null {
  if (canSend === 'AVAILABLE' && issues.length === 0) return null;

  // Blocking errors pehle - unme code hota hai
  const withCode = issues.filter((i) => i.code);
  const chosen = withCode[0] || issues[0];
  if (!chosen) return null;

  const where =
    chosen.entity === 'WABA'
      ? 'WhatsApp Business Account'
      : chosen.entity === 'BUSINESS'
      ? 'Business Portfolio'
      : chosen.entity === 'APP'
      ? 'App'
      : 'Phone number';

  return chosen.solution
    ? `${where}: ${chosen.description} ${chosen.solution}`
    : `${where}: ${chosen.description}`;
}

export const accountHealthService = {
  /**
   * Account ki sehat lao. Default me 5 minute cache; force se hamesha Meta se.
   */
  async get(accountId: string, opts: { force?: boolean } = {}): Promise<AccountHealth> {
    const account = await prisma.whatsAppAccount.findUnique({
      where: { id: accountId },
      select: {
        id: true, phoneNumberId: true, accessToken: true,
        healthCanSend: true, healthBlockedReason: true,
        healthStatus: true, healthCheckedAt: true,
      },
    });

    if (!account) {
      return {
        canSend: 'UNKNOWN', blocked: false, summary: null,
        issues: [], checkedAt: new Date(), fresh: false,
      };
    }

    const cachedAge = account.healthCheckedAt
      ? Date.now() - new Date(account.healthCheckedAt).getTime()
      : Infinity;

    if (!opts.force && cachedAge < CACHE_TTL_MS && account.healthCanSend) {
      const parsed = parse(account.healthStatus);
      return {
        canSend: normalise(account.healthCanSend),
        blocked: normalise(account.healthCanSend) === 'BLOCKED',
        summary: account.healthBlockedReason,
        issues: parsed.issues,
        checkedAt: new Date(account.healthCheckedAt!),
        fresh: false,
      };
    }

    // Meta se taaza lao
    try {
      const token = account.accessToken ? decrypt(account.accessToken) : null;
      if (!token || !account.phoneNumberId) throw new Error('No token');

      const raw = await metaApi.getHealthStatus(account.phoneNumberId, token);
      const { canSend, issues } = parse(raw);
      const summary = buildSummary(canSend, issues);

      await prisma.whatsAppAccount.update({
        where: { id: accountId },
        data: {
          healthCanSend: canSend,
          healthBlockedReason: summary,
          healthStatus: raw as any,
          healthCheckedAt: new Date(),
        } as any,
      }).catch(() => { /* health likhne me fail ho to send mat roko */ });

      return {
        canSend, blocked: canSend === 'BLOCKED', summary,
        issues, checkedAt: new Date(), fresh: true,
      };
    } catch (err: any) {
      // Health check khud fail ho jaye to kuch mat roko - purana data laut do.
      console.warn(`⚠️ [Health] check failed for ${accountId}: ${err?.message}`);
      const parsed = parse(account.healthStatus);
      return {
        canSend: normalise(account.healthCanSend),
        blocked: false, // pata hi nahi to block mat karo
        summary: account.healthBlockedReason,
        issues: parsed.issues,
        checkedAt: account.healthCheckedAt || new Date(),
        fresh: false,
      };
    }
  },

  /**
   * Send fail hone ke baad wajah dhoondo. Meta ke opaque errors -
   * khaaskar (#135000) - ke saath ye asli kahani deta hai.
   */
  async explainFailure(
    accountId: string,
    metaCode?: number
  ): Promise<string | null> {
    const OPAQUE = [135000, 131000, 368];
    if (metaCode && !OPAQUE.includes(Number(metaCode))) return null;

    const health = await this.get(accountId, { force: true }).catch(() => null);
    if (!health) return null;

    if (health.summary) return health.summary;

    if (health.canSend === 'LIMITED') {
      const info = health.issues.find((i) => !i.code)?.description;
      return info
        ? `WhatsApp has limited this number. ${info}`
        : 'WhatsApp has limited what this number can send right now.';
    }

    return null;
  },
};

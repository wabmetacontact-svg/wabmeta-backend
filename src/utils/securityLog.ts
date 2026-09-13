// src/utils/securityLog.ts
//
// Security events ka record - SecurityEvent table me, aur Sentry me warning.
//
// Yahan kabhi bhi password, token ya secret mat bhejna. Ye rows support padhegi
// aur inka retention lamba hai.

import prisma from '../config/database';
import type { Request } from 'express';
import { captureWarning } from '../config/monitoring';

export type SecurityEventType =
  | 'LOGIN_FAILED'
  | 'LOGIN_LOCKED'
  | 'LOGIN_ON_LOCKED_ACCOUNT'
  | 'LOGIN_SUCCESS'
  | 'ORG_HEADER_MISMATCH';

/** Sentry par sirf wo cheezein jo insaan ko dekhni chahiye. */
const ALERT_WORTHY: SecurityEventType[] = ['LOGIN_LOCKED', 'ORG_HEADER_MISMATCH'];

export interface SecurityEventInput {
  type: SecurityEventType;
  email?: string | null;
  userId?: string | null;
  organizationId?: string | null;
  ip?: string | null;
  userAgent?: string | null;
  detail?: Record<string, unknown>;
}

/** Request se client ka pata - trust proxy set hai, to x-forwarded-for pehla hop. */
export const requestOrigin = (req?: Request) => ({
  ip:
    (req?.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
    req?.ip ||
    null,
  userAgent: (req?.headers['user-agent'] as string)?.slice(0, 300) || null,
});

/**
 * Event likho. Kabhi throw nahi karta aur kabhi await karne layak nahi -
 * logging ki wajah se login fail nahi hona chahiye.
 */
export const recordSecurityEvent = (input: SecurityEventInput): void => {
  const { type, detail = {} } = input;

  prisma.securityEvent
    .create({
      data: {
        type,
        email: input.email?.toLowerCase().slice(0, 320) || null,
        userId: input.userId || null,
        organizationId: input.organizationId || null,
        ip: input.ip || null,
        userAgent: input.userAgent || null,
        detail: detail as any,
      },
    })
    .catch((err: any) => {
      // Table na ho (migration baaki) to bhi app chalti rahe.
      console.error('securityLog write failed:', err?.message || err);
    });

  if (ALERT_WORTHY.includes(type)) {
    captureWarning(`security: ${type}`, {
      email: input.email || undefined,
      ip: input.ip || undefined,
      ...detail,
    });
  }
};

export default recordSecurityEvent;

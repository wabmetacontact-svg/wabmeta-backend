// src/modules/meta/qualityAlert.ts
//
// Number ki quality rating girne par org ko notification.
//
// Meta quality rating teen hi deta hai: GREEN (High), YELLOW (Medium),
// RED (Low). Sirf GIRNE par notify karte hain (GREEN -> YELLOW, kuch bhi ->
// RED) - roz ki sync par same rating dobara aane se har din notification na
// jaaye. Rating sudhar kar phir giri to phir notify hoga.
//
// Admin ne display override lagaya ho to user ko wahi rating dikhti hai
// (accountView.ts), isliye tab notification nahi bhejte - warna notification
// aur dashboard alag-alag baat kehte.

import { notificationsService } from '../notifications/notifications.service';
import logger from '../../utils/logger';

export type QualityLevel = 'HIGH' | 'MEDIUM' | 'LOW' | 'UNKNOWN';

export function qualityLevel(rating?: string | null): QualityLevel {
  switch (String(rating || '').toUpperCase()) {
    case 'GREEN':
    case 'HIGH':
      return 'HIGH';
    case 'YELLOW':
    case 'MEDIUM':
      return 'MEDIUM';
    case 'RED':
    case 'LOW':
      return 'LOW';
    default:
      return 'UNKNOWN';
  }
}

const RANK: Record<QualityLevel, number> = { UNKNOWN: 0, HIGH: 0, MEDIUM: 1, LOW: 2 };

/** true jab rating MEDIUM/LOW tak giri ho (pehle se behtar thi). */
export function qualityDropped(previous?: string | null, next?: string | null): boolean {
  const n = RANK[qualityLevel(next)];
  return n > 0 && n > RANK[qualityLevel(previous)];
}

const GUIDANCE =
  'Warm up the number: send only Utility templates for now, keep a chatbot ' +
  'answering replies, and restart campaigns small (max 25 contacts on day 1, ' +
  'increasing gradually for at least a week). Open your dashboard for the full guide.';

export async function notifyIfQualityDropped(input: {
  accountId: string;
  organizationId: string;
  phoneNumber?: string | null;
  previous?: string | null;
  next?: string | null;
  override?: string | null;
}): Promise<void> {
  if (input.override) return;
  if (!qualityDropped(input.previous, input.next)) return;

  const level = qualityLevel(input.next);
  const number = input.phoneNumber || 'your WhatsApp number';

  try {
    await notificationsService.notifyOrganization(input.organizationId, {
      type: 'whatsapp',
      title:
        level === 'LOW'
          ? `Quality of ${number} is Low`
          : `Quality of ${number} dropped to Medium`,
      description:
        (level === 'LOW'
          ? 'Meta may limit or block this number if quality stays low. '
          : 'Meta has flagged this number - act now before it drops to Low. ') + GUIDANCE,
      actionUrl: '/dashboard',
      metadata: {
        accountId: input.accountId,
        qualityRating: input.next,
        previousQualityRating: input.previous ?? null,
        webUrl: '/dashboard',
      },
    });
    logger.info(
      `[Quality] ${number}: ${input.previous || 'UNKNOWN'} -> ${input.next} - org notified`
    );
  } catch (err) {
    logger.error('[Quality] notify failed:', err);
  }
}

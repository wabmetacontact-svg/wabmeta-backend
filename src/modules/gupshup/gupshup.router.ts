// src/modules/gupshup/gupshup.router.ts
//
// Har outgoing message yahan se tay hota hai: Meta Cloud API direct, ya Gupshup.
// Gupshup ke Partner Solution se onboard hue number par Meta ki "Send messages"
// permission sirf partner (Gupshup) ke paas hai, isliye wahan seedha Meta par
// bhejna fail hota hai.
//
// Callers (whatsapp.api.ts, meta.api.ts) ka code nahi badalta: ye wahi
// `{ data }` shape lautata hai jo axios deta hai, aur Gupshup ki galti ko bhi
// Meta jaisi error shape (`response.data.error`) me badal deta hai, taaki
// unka handleError aur retry pehle jaise chalein.
//
// Sirf message SEND yahan se jaata hai. Mark-as-read / typing, media upload,
// templates - Gupshup ke kehne par seedhe Meta se hi.

import prisma from '../../config/database';
import { gupshupApi, GupshupApiError } from './gupshup.api';
import { assertOrgCanSend } from '../admin/orgControl';
import { randomUUID } from 'crypto';
import {
  deductWalletForService,
  attachServiceChargeRef,
  refundServiceCharge,
} from '../wallet/wallet.deduction.service';

/** Template ke alawa sab (text, media, interactive, reaction...) Meta ka "service message" hai. */
export function isServiceMessage(payload: any): boolean {
  return String(payload?.type || 'text').toLowerCase() !== 'template';
}

export interface SendRoute {
  provider: 'META' | 'GUPSHUP';
  appId: string | null;
  status: string | null;
  organizationId: string | null;
}

const CACHE_MS = 60_000;
const cache = new Map<string, { route: SendRoute; at: number }>();

export async function getSendRoute(phoneNumberId: string): Promise<SendRoute> {
  const hit = cache.get(phoneNumberId);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.route;

  const acc = await prisma.whatsAppAccount.findUnique({
    where: { phoneNumberId },
    select: { sendProvider: true, gupshupAppId: true, gupshupStatus: true, organizationId: true },
  });
  const route: SendRoute =
    acc?.sendProvider === 'GUPSHUP'
      ? { provider: 'GUPSHUP', appId: acc.gupshupAppId, status: acc.gupshupStatus, organizationId: acc.organizationId }
      : { provider: 'META', appId: null, status: null, organizationId: acc?.organizationId ?? null };

  cache.set(phoneNumberId, { route, at: Date.now() });
  if (cache.size > 5000) cache.clear();
  return route;
}

/** Account ka provider ya Gupshup status badle to turant naya route lo. */
export function invalidateSendRoute(phoneNumberId?: string | null) {
  if (phoneNumberId) cache.delete(phoneNumberId);
  else cache.clear();
}

/** Meta jaisi axios error - callers ka handleError isse hi padhta hai. */
function metaShapedError(message: string, status: number, code?: number, extra?: any) {
  const err: any = new Error(message);
  err.response = {
    status,
    data: { error: { message, code: code ?? status, ...(extra || {}) } },
  };
  return err;
}

/**
 * `${phoneNumberId}/messages` par jaane wala send. `metaPost` wahi purani
 * axios call hai - META number par bas use chala dete hain.
 */
export async function routeSend<T = any>(
  phoneNumberId: string,
  payload: any,
  metaPost: () => Promise<{ data: T }>
): Promise<{ data: T }> {
  const route = await getSendRoute(phoneNumberId);
  if (route.provider === 'META') return metaPost();

  if (!route.appId || route.status !== 'LIVE') {
    throw metaShapedError(
      'This WhatsApp number is still being activated with Gupshup. Messages can be sent once activation completes.',
      409,
      0,
      { error_subcode: 'GUPSHUP_NOT_LIVE' }
    );
  }

  // Meta wale raaste par ye rok axios interceptor (installSendGuard) lagata
  // hai; Gupshup call us client se nahi jaati, isliye yahan khud lagao -
  // suspended / read-only org ke messages yahan bhi rukne chahiye.
  if (route.organizationId) await assertOrgCanSend(route.organizationId);

  // Service message ka Meta bill hamare Gupshup wallet se katta hai - pehle
  // customer ke wallet se kato. Balance na ho to message mat bhejo.
  let chargeRef: string | null = null;
  if (route.organizationId && isServiceMessage(payload)) {
    const ref = `svc_${randomUUID()}`;
    const charge = await deductWalletForService({
      organizationId: route.organizationId,
      recipientPhone: String(payload?.to || ''),
      ref,
    });
    if (charge.insufficient) {
      throw metaShapedError(
        'Your WabMeta wallet balance is too low to send this message. Please recharge your wallet.',
        402,
        0,
        { error_subcode: 'WALLET_INSUFFICIENT' }
      );
    }
    if (charge.deducted) chargeRef = ref;
  }

  try {
    const data = await gupshupApi.sendPassthrough(route.appId, payload);
    const messageId = (data as any)?.messages?.[0]?.id;
    if (chargeRef && messageId) {
      // Delivery fail hone par refund isi id (baad me wamid) se dhoondha jaata hai
      await attachServiceChargeRef(chargeRef, String(messageId)).catch(() => {});
    }
    return { data };
  } catch (e: any) {
    if (chargeRef) await refundServiceCharge(chargeRef, 'send failed').catch(() => {});
    if (e instanceof GupshupApiError) {
      const meta = e.data?.error;
      throw metaShapedError(e.message, e.status || 502, meta?.code, meta);
    }
    throw e;
  }
}

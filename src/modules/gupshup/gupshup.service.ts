// src/modules/gupshup/gupshup.service.ts
//
// Gupshup (Solution Partner) ke saath number ka jeevan-chakra:
//
//   1. Customer hamare Embedded Signup se Partner Solution ID ke saath connect
//      karta hai. meta.service register NAHI karta (Gupshup docs: "Register the
//      WABA using the registration API" mana hai - Gupshup link ke andar khud
//      karta hai) aur account sendProvider=GUPSHUP ke saath save hota hai.
//   2. linkAccount: POST /partner/tpp/app -> Gupshup appId, status LINKING.
//   3. Gupshup callback URL par "live" event (ya pipeline poll) -> markLive:
//      status LIVE + V3 subscription (statuses ke liye gs_id <-> wamid).
//   4. Ab is number ke saare sends gupshup.router se Gupshup ko jaate hain.
//
// ID milana: Gupshup ka send jawab Gupshup message id deta hai, jo callers
// Message / CampaignContact / MessageQueue ke waMessageId me rakh dete hain.
// V3 status callback me gs_id (Gupshup id) aur id (wamid) dono aate hain -
// mapStatusIds us gs_id ko wamid se badal deta hai, taaki Meta ke statuses
// (jo wamid par aate hain) sahi message se judein.

import prisma from '../../config/database';
import { config } from '../../config';
import logger from '../../utils/logger';
import { gupshupApi } from './gupshup.api';
import { invalidateSendRoute } from './gupshup.router';

const POLL_EVERY_MS = 30_000;
const POLL_FOR_MS = 15 * 60_000;

/** Gupshup app name: 6-150 chars, sirf letters/digits, poore Gupshup me unique. */
export function gupshupAppName(phoneDigits: string, attempt = 0): string {
  const base = `WABMeta${phoneDigits.replace(/\D/g, '')}`;
  const name = attempt === 0 ? base : `${base}x${Date.now().toString(36)}`;
  return name.slice(0, 150);
}

export function callbackUrlWithKey(): string {
  const url = new URL(config.gupshup.callbackUrl);
  if (config.gupshup.callbackSecret) url.searchParams.set('key', config.gupshup.callbackSecret);
  return url.toString();
}

/** Connect ke waqt: kya ye signup Gupshup ke Partner Solution se hua? */
export function isGupshupSignup(solutionId?: string | null, coexistence?: boolean): boolean {
  const configured = config.gupshup.solutionId;
  return !!configured && !coexistence && String(solutionId || '') === configured && gupshupApi.isConfigured();
}

async function setState(accountId: string, data: Record<string, any>) {
  const acc = await prisma.whatsAppAccount.update({
    where: { id: accountId },
    data,
    select: { phoneNumberId: true },
  });
  invalidateSendRoute(acc.phoneNumberId);
}

/** Pipeline ka jawab: LIVE / ERROR / abhi chal raha (null). */
export function pipelineOutcome(p: { creationStage?: string; pipeLineStage?: string }): 'LIVE' | 'ERROR' | null {
  if (p.creationStage === 'WHATSAPP_PROVISIONING_DONE' && p.pipeLineStage === 'FINALIZE') return 'LIVE';
  if (p.creationStage === 'ERROR') return 'ERROR';
  return null;
}

export const gupshupService = {
  /** Account ko Gupshup app se jodo. Dobara chalana safe - appId ho to sirf status dekhta hai. */
  async linkAccount(accountId: string): Promise<{ appId?: string; error?: string }> {
    const acc = await prisma.whatsAppAccount.findUnique({
      where: { id: accountId },
      select: { id: true, wabaId: true, phoneNumber: true, gupshupAppId: true, gupshupStatus: true },
    });
    if (!acc) return { error: 'Account not found' };

    if (acc.gupshupAppId) {
      if (acc.gupshupStatus !== 'LIVE') this.pollUntilLive(acc.id, acc.gupshupAppId);
      return { appId: acc.gupshupAppId };
    }

    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const { appId } = await gupshupApi.linkApp({
          name: gupshupAppName(acc.phoneNumber, attempt),
          wabaId: acc.wabaId,
          phone: acc.phoneNumber.replace(/\D/g, ''),
          callbackUrl: callbackUrlWithKey(),
        });
        await setState(acc.id, {
          gupshupAppId: appId,
          gupshupStatus: 'LINKING',
          gupshupError: null,
          gupshupLinkedAt: new Date(),
        });
        logger.info(`[Gupshup] linked account ${acc.id} -> app ${appId}`);
        this.pollUntilLive(acc.id, appId);
        return { appId };
      } catch (e: any) {
        // 409 = is naam ka app pehle se hai (pichhli adhuri koshish) - naya naam
        if (e?.status === 409 && attempt === 0) continue;
        await setState(acc.id, { gupshupStatus: 'ERROR', gupshupError: e?.message || 'Link failed' });
        logger.error(`[Gupshup] link failed for account ${acc.id}: ${e?.message}`);
        return { error: e?.message || 'Link failed' };
      }
    }
    return { error: 'Link failed' };
  },

  /** Live event na aaye to bhi pipeline dekh kar LIVE/ERROR tay karo. */
  pollUntilLive(accountId: string, appId: string) {
    const started = Date.now();
    const tick = async () => {
      try {
        const acc = await prisma.whatsAppAccount.findUnique({
          where: { id: accountId },
          select: { gupshupStatus: true, gupshupAppId: true },
        });
        if (!acc || acc.gupshupAppId !== appId || acc.gupshupStatus === 'LIVE') return;

        const outcome = pipelineOutcome(await gupshupApi.getPipeline(appId));
        if (outcome === 'LIVE') return void (await this.markLive(appId));
        // ERROR par Gupshup khud 3 baar retry karta hai - window ke aakhir tak ruko
        if (Date.now() - started >= POLL_FOR_MS) {
          if (outcome === 'ERROR') {
            await setState(accountId, { gupshupStatus: 'ERROR', gupshupError: 'Gupshup activation failed' });
          }
          return;
        }
      } catch (e: any) {
        logger.warn(`[Gupshup] pipeline check failed for ${appId}: ${e?.message}`);
        if (Date.now() - started >= POLL_FOR_MS) return;
      }
      setTimeout(tick, POLL_EVERY_MS).unref?.();
    };
    setTimeout(tick, POLL_EVERY_MS).unref?.();
  },

  /** Number Gupshup par live: status LIVE + V3 subscription. */
  async markLive(appId: string): Promise<void> {
    const acc = await prisma.whatsAppAccount.findUnique({
      where: { gupshupAppId: appId },
      select: { id: true, gupshupStatus: true, gupshupSubscriptionId: true },
    });
    if (!acc) {
      logger.warn(`[Gupshup] live event for unknown app ${appId}`);
      return;
    }

    let subscriptionId = acc.gupshupSubscriptionId;
    let error: string | null = null;
    if (!subscriptionId) {
      try {
        ({ subscriptionId } = await gupshupApi.createSubscription(
          appId,
          callbackUrlWithKey(),
          config.gupshup.subscriptionModes
        ));
      } catch (e: any) {
        // Number phir bhi live hai - bas statuses ke ID milne me dikkat hogi
        error = `Subscription failed: ${e?.message}`;
        logger.error(`[Gupshup] ${error} (app ${appId})`);
      }
    }

    await setState(acc.id, {
      gupshupStatus: 'LIVE',
      gupshupLiveAt: acc.gupshupStatus === 'LIVE' ? undefined : new Date(),
      gupshupSubscriptionId: subscriptionId,
      gupshupError: error,
    });
    logger.info(`[Gupshup] app ${appId} is LIVE`);
  },

  /** Gupshup message id (send ke jawab wali) ko asli wamid se badlo. */
  async mapStatusIds(gsId: string, wamid: string): Promise<void> {
    if (!gsId || !wamid || gsId === wamid) return;
    await Promise.all([
      prisma.message.updateMany({ where: { waMessageId: gsId }, data: { waMessageId: wamid } }),
      prisma.message.updateMany({ where: { wamId: gsId }, data: { wamId: wamid } }),
      prisma.message.updateMany({ where: { whatsappMessageId: gsId }, data: { whatsappMessageId: wamid } }),
      prisma.campaignContact.updateMany({ where: { waMessageId: gsId }, data: { waMessageId: wamid } }),
      prisma.messageQueue.updateMany({ where: { waMessageId: gsId }, data: { waMessageId: wamid } }),
      // Service message ka charge - delivery fail par refund wamid se milta hai
      prisma.walletTransaction.updateMany({
        where: { metaChargeId: gsId, metaService: 'service_message' },
        data: { metaChargeId: wamid },
      }),
    ]);
  },

  /**
   * Gupshup callback. Do tarah ke payload:
   *  - onboarding-event / docker-status-event "live" (link ke waqt diya URL)
   *  - V3 events: Meta jaisa payload + statuses[].gs_id + gs_app_id
   * V3 me IDs milao, phir Meta wale handler se hi process karo. Agar Meta
   * seedha bhi bhejta hai to dono me se jo pehle aaye - message create unique
   * waMessageId se aur statuses "sirf aage badho" lock se ek hi baar lagte hain.
   */
  async handleCallback(body: any): Promise<string> {
    if (body?.type === 'onboarding-event') {
      const ev = body?.payload;
      if (ev?.type === 'docker-status-event' && String(ev?.payload?.status).toLowerCase() === 'live' && body?.appId) {
        await this.markLive(String(body.appId));
        return 'live';
      }
      return `onboarding:${ev?.type || 'unknown'}`;
    }

    if (body?.object !== 'whatsapp_business_account' || !Array.isArray(body?.entry)) {
      return `ignored:${body?.type || 'unknown'}`;
    }

    const acc = body?.gs_app_id
      ? await prisma.whatsAppAccount.findUnique({
          where: { gupshupAppId: String(body.gs_app_id) },
          select: { phoneNumberId: true, wabaId: true },
        })
      : null;

    // 1. IDs milao (enqueued/dispatched me hi wamid pehli baar milta hai)
    for (const entry of body.entry) {
      for (const change of entry?.changes || []) {
        for (const st of change?.value?.statuses || []) {
          if (st?.gs_id && st?.id) await this.mapStatusIds(String(st.gs_id), String(st.id));
        }
      }
    }

    // 2. Meta jaisa payload bana kar wahi handler chalao
    const QUEUE_ONLY = new Set(['enqueued', 'dispatched']);
    const metaPayload = {
      object: 'whatsapp_business_account',
      entry: body.entry.map((entry: any) => ({
        ...entry,
        id: entry?.id || acc?.wabaId,
        changes: (entry?.changes || []).map((change: any) => {
          const value = { ...(change?.value || {}) };
          if (!value.metadata?.phone_number_id && acc?.phoneNumberId) {
            value.metadata = { ...(value.metadata || {}), phone_number_id: acc.phoneNumberId };
          }
          if (Array.isArray(value.statuses)) {
            value.statuses = value.statuses
              .filter((st: any) => !QUEUE_ONLY.has(String(st?.status).toLowerCase()))
              .map(({ gs_id, ...st }: any) => st);
          }
          return { ...change, value };
        }),
      })),
    };

    const hasWork = metaPayload.entry.some((e: any) =>
      e.changes.some((c: any) => c.value?.messages?.length || c.value?.statuses?.length || c.field !== 'messages')
    );
    if (!hasWork) return 'mapped';

    const { webhookService } = await import('../webhooks/webhook.service');
    const result = await webhookService.handleWebhook(metaPayload);
    return result?.status || 'processed';
  },
};

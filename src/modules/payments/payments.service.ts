// src/modules/payments/payments.service.ts
//
// Client ke APNE Razorpay account se customer ko payment link. Paisa seedha
// client ke account me jata hai - WabMeta beech me nahi aata. WabMeta ke apne
// Razorpay keys (subscription + wallet top-up) env me hain aur inse alag hain.
//
// Payment ka pata do raaste se chalta hai: client ka webhook (turant) aur
// scheduler ka polling (fallback). Isliye confirm karne wala kaam idempotent
// hai - do baar aaye to bhi lead ek hi baar Won hogi aur receipt ek hi baar.

import Razorpay from 'razorpay';
import prisma from '../../config/database';
import { AppError } from '../../middleware/errorHandler';
import { encrypt, safeDecrypt } from '../../utils/encryption';
import { whatsappService } from '../whatsapp/whatsapp.service';
import { notificationsService } from '../notifications/notifications.service';
import { crmService } from '../crm/crm.service';

const DEFAULT_EXPIRY_HOURS = 7 * 24;
/** Razorpay ka minimum ₹1 hai */
const MIN_PAISE = 100;
const MAX_PAISE = 100_000_000; // ₹10 lakh se upar galti se na ban jaye

export type CreatedVia = 'manual' | 'ai_agent' | 'automation';

const rupees = (paise: number) =>
  '₹' + new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 }).format(paise / 100);

function razorpayFor(keyId: string, keySecret: string) {
  return new Razorpay({ key_id: keyId, key_secret: keySecret }) as any;
}

/** Org ka gateway + ready Razorpay client. Na juda ho to saaf error. */
export async function getGatewayClient(organizationId: string) {
  const gateway = await prisma.paymentGateway.findUnique({ where: { organizationId } });
  if (!gateway || !gateway.isActive) {
    throw new AppError('Razorpay is not connected. Add your keys in Settings first.', 400);
  }
  const keySecret = safeDecrypt(gateway.keySecret);
  if (!keySecret) {
    throw new AppError('Saved Razorpay secret could not be read. Please reconnect Razorpay.', 400);
  }
  return { gateway, client: razorpayFor(gateway.keyId, keySecret) };
}

export const paymentsService = {
  /** Settings page ke liye - secret kabhi wapas nahi bhejte */
  async getGateway(organizationId: string) {
    const gateway = await prisma.paymentGateway.findUnique({ where: { organizationId } });
    if (!gateway) return { connected: false };
    return {
      connected: true,
      provider: gateway.provider,
      keyId: gateway.keyId,
      displayName: gateway.displayName,
      isActive: gateway.isActive,
      webhookConfigured: !!gateway.webhookSecret,
      updatedAt: gateway.updatedAt,
    };
  },

  /**
   * Keys save karne se pehle Razorpay se ek chhoti call karke jaanch lete hain -
   * warna galat key mahino baad pehle payment link par pakdi jati.
   */
  async connectGateway(
    organizationId: string,
    body: { keyId?: string; keySecret?: string; webhookSecret?: string | null; displayName?: string | null }
  ) {
    const keyId = String(body.keyId || '').trim();
    const keySecret = String(body.keySecret || '').trim();
    if (!keyId || !keySecret) throw new AppError('keyId and keySecret are required', 400);
    if (!/^rzp_(test|live)_/.test(keyId)) {
      throw new AppError('That does not look like a Razorpay key id (it starts with rzp_live_ or rzp_test_)', 400);
    }

    try {
      await razorpayFor(keyId, keySecret).payments.all({ count: 1 });
    } catch (err: any) {
      const status = err?.statusCode || err?.status;
      if (status === 401 || status === 400) {
        throw new AppError('Razorpay rejected these keys. Check the key id and secret.', 400);
      }
      throw new AppError(`Could not reach Razorpay: ${err?.message || 'unknown error'}`, 502);
    }

    const data = {
      keyId,
      keySecret: encrypt(keySecret),
      webhookSecret: body.webhookSecret ? encrypt(String(body.webhookSecret).trim()) : null,
      displayName: body.displayName ? String(body.displayName).slice(0, 100) : null,
      isActive: true,
    };

    await prisma.paymentGateway.upsert({
      where: { organizationId },
      create: { organizationId, ...data },
      update: data,
    });
    return this.getGateway(organizationId);
  },

  async disconnectGateway(organizationId: string) {
    await prisma.paymentGateway.deleteMany({ where: { organizationId } });
    return { connected: false };
  },

  /**
   * Payment link banao aur (phone mile to) WhatsApp par bhej do.
   * amountPaise hi sach hai - rupaye sirf UI ke liye.
   */
  async createPaymentLink(input: {
    organizationId: string;
    amountPaise: number;
    description?: string;
    leadId?: string;
    contactId?: string;
    conversationId?: string;
    createdVia?: CreatedVia;
    createdById?: string;
    expiresInHours?: number;
    sendOnWhatsApp?: boolean;
  }) {
    const amountPaise = Math.round(Number(input.amountPaise));
    if (!Number.isFinite(amountPaise) || amountPaise < MIN_PAISE) {
      throw new AppError('Amount must be at least ₹1', 400);
    }
    if (amountPaise > MAX_PAISE) {
      throw new AppError('Amount is too large for a payment link', 400);
    }

    const { client } = await getGatewayClient(input.organizationId);

    // Lead se contact nikal lo taaki caller ko dono bhejne na padein
    let lead = null as any;
    if (input.leadId) {
      lead = await prisma.lead.findFirst({
        where: { id: input.leadId, organizationId: input.organizationId },
        select: { id: true, contactId: true, title: true },
      });
      if (!lead) throw new AppError('Lead not found', 404);
    }

    const contactId = input.contactId || lead?.contactId || undefined;
    const contact = contactId
      ? await prisma.contact.findFirst({
          where: { id: contactId, organizationId: input.organizationId },
          select: { id: true, phone: true, firstName: true, lastName: true, email: true, whatsappProfileName: true },
        })
      : null;

    const customerName =
      [contact?.firstName, contact?.lastName].filter((n) => n && n !== 'Unknown').join(' ') ||
      contact?.whatsappProfileName ||
      'Customer';

    const description = (input.description || lead?.title || 'Payment').toString().slice(0, 2048);
    const expireBy = Math.floor(
      (Date.now() + (input.expiresInHours || DEFAULT_EXPIRY_HOURS) * 3600_000) / 1000
    );

    let link: any;
    try {
      link = await client.paymentLink.create({
        amount: amountPaise,
        currency: 'INR',
        description,
        customer: {
          name: customerName,
          ...(contact?.phone ? { contact: contact.phone } : {}),
          ...(contact?.email ? { email: contact.email } : {}),
        },
        // Razorpay ko SMS/email nahi bhejne dete - hum WhatsApp par bhejte hain
        notify: { sms: false, email: false },
        reminder_enable: false,
        expire_by: expireBy,
        notes: {
          organizationId: input.organizationId,
          ...(input.leadId ? { leadId: input.leadId } : {}),
          source: 'wabmeta',
        },
      });
    } catch (err: any) {
      const detail = err?.error?.description || err?.message || 'unknown error';
      throw new AppError(`Razorpay could not create the payment link: ${detail}`, 502);
    }

    const payment = await prisma.leadPayment.create({
      data: {
        organizationId: input.organizationId,
        leadId: lead?.id ?? null,
        contactId: contact?.id ?? null,
        conversationId: input.conversationId ?? null,
        amountPaise,
        description,
        status: 'PENDING',
        providerLinkId: String(link.id),
        shortUrl: String(link.short_url),
        expiresAt: new Date(expireBy * 1000),
        createdVia: input.createdVia || 'manual',
        createdById: input.createdById ?? null,
      },
    });

    let sent = false;
    if (input.sendOnWhatsApp !== false && contact?.phone) {
      sent = await this.sendLinkOnWhatsApp(payment.id).catch(() => false);
    }

    if (lead?.id) {
      await prisma.leadActivity.create({
        data: {
          leadId: lead.id,
          userId: input.createdById ?? null,
          type: 'NOTE',
          title: `💳 Payment link sent: ${rupees(amountPaise)}`,
          metadata: { paymentId: payment.id, shortUrl: payment.shortUrl, via: payment.createdVia },
        },
      }).catch(() => {});
    }

    return { payment, sent };
  },

  /** Link ka message customer ko. Window band ho to bhejte nahi - link phir bhi bana rehta hai. */
  async sendLinkOnWhatsApp(paymentId: string): Promise<boolean> {
    const payment = await prisma.leadPayment.findUnique({ where: { id: paymentId } });
    if (!payment || !payment.contactId) return false;

    const [contact, account, conversation] = await Promise.all([
      prisma.contact.findUnique({ where: { id: payment.contactId }, select: { phone: true, status: true } }),
      prisma.whatsAppAccount.findFirst({
        where: { organizationId: payment.organizationId, status: 'CONNECTED' },
        orderBy: { isDefault: 'desc' },
        select: { id: true },
      }),
      payment.conversationId
        ? prisma.conversation.findUnique({ where: { id: payment.conversationId }, select: { id: true } })
        : prisma.conversation.findFirst({
            where: { organizationId: payment.organizationId, contactId: payment.contactId, channel: 'WHATSAPP' },
            select: { id: true },
          }),
    ]);

    if (!contact?.phone || contact.status !== 'ACTIVE' || !account) return false;

    const text =
      `${payment.description}\n\n` +
      `Amount: ${rupees(payment.amountPaise)}\n` +
      `Pay securely here: ${payment.shortUrl}`;

    try {
      await whatsappService.sendTextMessage(
        account.id,
        contact.phone,
        text,
        conversation?.id,
        payment.organizationId
      );
      return true;
    } catch (err: any) {
      // 24h window band - link bana rehta hai, agent copy karke bhej sakta hai
      console.warn(`⚠️ Could not send payment link ${payment.id}: ${err?.message}`);
      return false;
    }
  },

  /** Razorpay se taaza haal lo aur DB me utaaro (polling aur manual refresh dono). */
  async syncPayment(paymentId: string) {
    const payment = await prisma.leadPayment.findUnique({ where: { id: paymentId } });
    if (!payment) throw new AppError('Payment not found', 404);
    if (payment.status !== 'PENDING') return payment;

    const { client } = await getGatewayClient(payment.organizationId);
    let link: any;
    try {
      link = await client.paymentLink.fetch(payment.providerLinkId);
    } catch (err: any) {
      await prisma.leadPayment.update({ where: { id: payment.id }, data: { lastCheckedAt: new Date() } });
      throw new AppError(`Could not read the payment status: ${err?.message || 'unknown error'}`, 502);
    }

    await prisma.leadPayment.update({ where: { id: payment.id }, data: { lastCheckedAt: new Date() } });

    const status = String(link?.status || '');
    if (status === 'paid') {
      const providerPaymentId =
        (Array.isArray(link?.payments) ? link.payments[0]?.payment_id : link?.payments?.payment_id) || null;
      await this.markPaid(payment.id, providerPaymentId);
    } else if (status === 'expired' || status === 'cancelled') {
      await prisma.leadPayment.updateMany({
        where: { id: payment.id, status: 'PENDING' },
        data: { status: status === 'expired' ? 'EXPIRED' : 'CANCELLED' },
      });
    }

    return prisma.leadPayment.findUnique({ where: { id: payment.id } });
  },

  /**
   * Payment mila. Webhook aur polling dono yahi bulate hain, isliye pehla
   * update hi jeetta hai - baaki chup-chaap lautte hain.
   */
  async markPaid(paymentId: string, providerPaymentId?: string | null) {
    const claimed = await prisma.leadPayment.updateMany({
      where: { id: paymentId, status: { not: 'PAID' } },
      data: { status: 'PAID', paidAt: new Date(), providerPaymentId: providerPaymentId ?? undefined },
    });
    if (claimed.count === 0) return null; // pehle hi ho chuka

    const payment = await prisma.leadPayment.findUnique({ where: { id: paymentId } });
    if (!payment) return null;

    console.log(`💰 Payment received: ${rupees(payment.amountPaise)} (org ${payment.organizationId})`);

    // 1. Lead ko Won stage me (crm se - activity log + LEAD_STAGE_CHANGED)
    if (payment.leadId) {
      try {
        const lead = await prisma.lead.findUnique({
          where: { id: payment.leadId },
          select: { id: true, pipelineId: true, value: true, assignedToId: true, title: true },
        });
        if (lead?.pipelineId) {
          const wonStage = await prisma.pipelineStage.findFirst({
            where: { pipelineId: lead.pipelineId, isWon: true },
            select: { id: true },
          });
          if (wonStage) {
            await crmService.updateLead(payment.organizationId, lead.id, null as any, {
              stageId: wonStage.id,
              ...(lead.value ? {} : { value: payment.amountPaise / 100 }),
            });
          }
        }
        await prisma.leadActivity.create({
          data: {
            leadId: payment.leadId,
            type: 'NOTE',
            title: `✅ Payment received: ${rupees(payment.amountPaise)}`,
            metadata: { paymentId: payment.id, providerPaymentId: payment.providerPaymentId },
          },
        }).catch(() => {});
      } catch (err: any) {
        console.error('Payment -> lead update failed:', err?.message);
      }
    }

    // 2. Customer ko receipt
    if (payment.contactId) {
      try {
        const [contact, account] = await Promise.all([
          prisma.contact.findUnique({ where: { id: payment.contactId }, select: { phone: true, status: true, firstName: true } }),
          prisma.whatsAppAccount.findFirst({
            where: { organizationId: payment.organizationId, status: 'CONNECTED' },
            orderBy: { isDefault: 'desc' },
            select: { id: true },
          }),
        ]);
        if (contact?.phone && contact.status === 'ACTIVE' && account) {
          const name = contact.firstName && contact.firstName !== 'Unknown' ? ` ${contact.firstName}` : '';
          await whatsappService.sendTextMessage(
            account.id,
            contact.phone,
            `Thank you${name}! 🎉 We have received your payment of ${rupees(payment.amountPaise)}.`,
            payment.conversationId || undefined,
            payment.organizationId
          );
        }
      } catch (err: any) {
        console.warn('Receipt message failed:', err?.message);
      }
    }

    // 3. Team ko notification
    try {
      const lead = payment.leadId
        ? await prisma.lead.findUnique({ where: { id: payment.leadId }, select: { assignedToId: true, title: true } })
        : null;
      const userId =
        lead?.assignedToId ||
        (await prisma.organization.findUnique({ where: { id: payment.organizationId }, select: { ownerId: true } }))?.ownerId;
      if (userId) {
        await notificationsService.create({
          userId,
          organizationId: payment.organizationId,
          type: 'billing',
          title: `💰 Payment received: ${rupees(payment.amountPaise)}`,
          description: lead?.title ? `${lead.title} - marked Won` : payment.description || 'Customer payment',
          actionUrl: payment.leadId ? `/(app)/crm/lead/${payment.leadId}` : '/(app)/crm',
          metadata: {
            paymentId: payment.id,
            leadId: payment.leadId,
            webUrl: payment.leadId ? `/dashboard/crm/leads/${payment.leadId}` : '/dashboard/crm',
          },
        });
      }
    } catch (err: any) {
      console.warn('Payment notification failed:', err?.message);
    }

    // 4. PAYMENT_RECEIVED automations
    try {
      const { automationEngine } = await import('../automation/automation.engine');
      await automationEngine.triggerPaymentReceived({
        organizationId: payment.organizationId,
        paymentId: payment.id,
        leadId: payment.leadId,
        contactId: payment.contactId,
        conversationId: payment.conversationId,
        amountPaise: payment.amountPaise,
      });
    } catch (err: any) {
      console.error('PAYMENT_RECEIVED automation failed:', err?.message);
    }

    return payment;
  },

  /** Webhook se aaya event - link id se dhoondh kar wahi kaam. */
  async applyWebhookEvent(organizationId: string, event: string, linkEntity: any, paymentEntity?: any) {
    const linkId = String(linkEntity?.id || '');
    if (!linkId) return;

    const payment = await prisma.leadPayment.findFirst({
      where: { providerLinkId: linkId, organizationId },
      select: { id: true },
    });
    if (!payment) {
      console.warn(`ℹ️ Webhook for unknown payment link ${linkId} (org ${organizationId})`);
      return;
    }

    if (event === 'payment_link.paid') {
      await this.markPaid(payment.id, paymentEntity?.id || null);
    } else if (event === 'payment_link.expired') {
      await prisma.leadPayment.updateMany({ where: { id: payment.id, status: 'PENDING' }, data: { status: 'EXPIRED' } });
    } else if (event === 'payment_link.cancelled') {
      await prisma.leadPayment.updateMany({ where: { id: payment.id, status: 'PENDING' }, data: { status: 'CANCELLED' } });
    }
  },

  async listForLead(organizationId: string, leadId: string) {
    return prisma.leadPayment.findMany({
      where: { organizationId, leadId },
      orderBy: { createdAt: 'desc' },
    });
  },

  async listRecent(organizationId: string, limit = 50) {
    return prisma.leadPayment.findMany({
      where: { organizationId },
      orderBy: { createdAt: 'desc' },
      take: Math.min(Math.max(Number(limit) || 50, 1), 200),
    });
  },

  /**
   * Scheduler: jin links ka webhook nahi aaya unhe Razorpay se khud poocho.
   * Expire ho chuke links ko bina call kiye EXPIRED kar dete hain.
   */
  async pollPendingPayments(): Promise<void> {
    const now = new Date();

    await prisma.leadPayment.updateMany({
      where: { status: 'PENDING', expiresAt: { lt: now } },
      data: { status: 'EXPIRED' },
    });

    const due = await prisma.leadPayment.findMany({
      where: {
        status: 'PENDING',
        OR: [{ lastCheckedAt: null }, { lastCheckedAt: { lt: new Date(now.getTime() - 3 * 60_000) } }],
      },
      orderBy: { lastCheckedAt: { sort: 'asc', nulls: 'first' } },
      take: 50,
      select: { id: true },
    });

    for (const p of due) {
      try {
        await this.syncPayment(p.id);
      } catch (err: any) {
        // Gateway hat gaya ya Razorpay down - agli baar phir dekh lenge
        console.warn(`⚠️ Payment poll failed for ${p.id}: ${err?.message}`);
      }
    }
  },
};

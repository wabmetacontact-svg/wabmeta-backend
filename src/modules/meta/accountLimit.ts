// src/modules/meta/accountLimit.ts
//
// Ek organization kitne WhatsApp numbers connect kar sakti hai.
//
// Pehle meta.routes.ts me hardcoded tha ki ek hi connected account ho sakta
// hai - plan chahe kuch bhi kahe. Naye tiers Pro par 2 aur Business par 3
// numbers bechte hain, to wo wada us check ke rehte poora ho hi nahi sakta
// tha. Ab limit plan se aati hai.
//
// Plan ya limit na mile to 1 - yahi aaj ka behaviour hai, aur is taraf
// jhukna surakshit hai: zyada de dena paise ka nuksan hai, kam dena ek
// support ticket.

import prisma from '../../config/database';
import { AppError } from '../../middleware/errorHandler';
import { effectiveLimit, parseLimitOverrides } from '../admin/orgControl';
import { getAddOnBoosts } from '../admin/addOns';

export const DEFAULT_MAX_ACCOUNTS = 1;

/** Plan ki limit ko ek theek number me badlo. */
export const accountLimitFor = (
  maxWhatsAppAccounts: number | null | undefined
): number => {
  const n = Number(maxWhatsAppAccounts);
  if (!Number.isFinite(n) || n <= 0) return DEFAULT_MAX_ACCOUNTS;
  return Math.floor(n);
};

/** Aur ek number juda ja sakta hai ya nahi. */
export const canConnectAnother = (
  connectedCount: number,
  limit: number
): boolean => connectedCount < limit;

/** Mana karne par user ko kya dikhe. */
export const limitReachedMessage = (
  connectedCount: number,
  limit: number
): string =>
  limit === 1
    ? 'Your plan includes one WhatsApp number. Disconnect the current one, or upgrade to connect another.'
    : `Your plan includes ${limit} WhatsApp numbers and ${connectedCount} are already connected. Disconnect one, or upgrade to add more.`;

/**
 * Naya number jodne se pehle rok.
 *
 * `tx` diya ja sakta hai taaki ye usi transaction me chale jisme account
 * banta hai - warna do parallel connects dono check paas kar ke limit se
 * upar chale jaate.
 */
export const assertCanConnectAnother = async (
  organizationId: string,
  tx: { whatsAppAccount: any; organization: any } = prisma as any
): Promise<void> => {
  const org = await tx.organization.findUnique({
    where: { id: organizationId },
    select: {
      limitOverrides: true,
      subscription: {
        select: { plan: { select: { maxWhatsAppAccounts: true } } },
      },
    },
  });

  // Read from the row, not the cache: this runs inside the transaction that
  // creates the account, and an admin may have just raised the limit.
  // Same transaction when the caller passed one, so a parallel connect sees it too.
  const boosts = await getAddOnBoosts(organizationId, (tx as any).clientAddOn ? (tx as any) : undefined);
  const limit =
    accountLimitFor(
      effectiveLimit(
        parseLimitOverrides(org?.limitOverrides),
        'whatsappNumbers',
        org?.subscription?.plan?.maxWhatsAppAccounts
      )
    ) + (boosts.whatsappNumbers ?? 0);

  const connectedCount = await tx.whatsAppAccount.count({
    where: { organizationId, status: 'CONNECTED' },
  });

  if (!canConnectAnother(connectedCount, limit)) {
    throw new AppError(limitReachedMessage(connectedCount, limit), 400);
  }
};

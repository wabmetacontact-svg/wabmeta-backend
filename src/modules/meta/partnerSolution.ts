// src/modules/meta/partnerSolution.ts
//
// Multi-Partner Solutions: how WabMeta, a Tech Provider, gets a credit line
// without being a Solution Partner itself.
//
// A Solution Partner and WabMeta create a "solution" together. Clients who
// sign up through Embedded Signup with that solution's ID are billed on the
// Solution Partner's credit line, not their own card. Meta bills the Solution
// Partner; WabMeta recovers the cost through the wallet.
//
// Everything here is inert until a solution is configured: with no solution
// ID at signup and no PARTNER_ADDED webhook, no account is ever touched.

import prisma from '../../config/database';

/** Meta object IDs are numeric strings. Anything else is not an ID. */
export const isMetaId = (value: unknown): value is string =>
  typeof value === 'string' && /^\d{5,30}$/.test(value.trim());

export interface PartnerAdded {
  wabaId: string;
  solutionId: string | null;
  ownerBusinessId: string | null;
}

/**
 * Read an account_update webhook's value.
 *
 * Returns null for anything other than PARTNER_ADDED. The WABA details are
 * read from value.waba_info, with value itself as a fallback: the field
 * names are documented, the nesting less clearly, and a payload that does
 * not parse is logged by the caller rather than guessed at.
 */
export const parsePartnerAdded = (value: any): PartnerAdded | null => {
  if (!value || String(value.event || '').toUpperCase() !== 'PARTNER_ADDED') {
    return null;
  }

  const info = value.waba_info && typeof value.waba_info === 'object'
    ? value.waba_info
    : value;

  const wabaId = String(info.waba_id ?? '').trim();
  if (!isMetaId(wabaId)) return null;

  const solutionId = String(info.solution_id ?? '').trim();
  const ownerBusinessId = String(info.owner_business_id ?? '').trim();

  return {
    wabaId,
    solutionId: isMetaId(solutionId) ? solutionId : null,
    ownerBusinessId: isMetaId(ownerBusinessId) ? ownerBusinessId : null,
  };
};

/**
 * Record Meta's confirmation that a client came in through a solution.
 *
 * This is the only thing that sets solutionConfirmedAt. What signup writes
 * is WabMeta's own belief about which flow the client used; this is Meta
 * saying the client is actually on the partner's credit line.
 *
 * The account row may not exist yet - the webhook can beat the signup
 * request that creates it. That is fine: signup writes solutionId from its
 * side, and the next PARTNER_ADDED (or a later sync) confirms it.
 */
export const recordPartnerAdded = async (
  event: PartnerAdded
): Promise<number> => {
  if (!event.solutionId) return 0;

  const result = await prisma.whatsAppAccount.updateMany({
    where: { wabaId: event.wabaId },
    data: {
      solutionId: event.solutionId,
      solutionConfirmedAt: new Date(),
    },
  });

  return result.count;
};

/**
 * Stamp the solution the client signed up through, from WabMeta's side.
 *
 * Called once signup has created the account. Never throws: a failure here
 * must not undo a connection that has already succeeded.
 */
export const recordSignupSolution = async (
  accountId: string | undefined,
  solutionId: unknown
): Promise<void> => {
  if (!accountId || !isMetaId(solutionId)) return;

  await prisma.whatsAppAccount
    .update({
      where: { id: accountId },
      data: { solutionId: solutionId.trim() },
    })
    .catch((err: any) => {
      console.warn(
        `⚠️ [Solution] could not record solution for ${accountId}: ${err?.message}`
      );
    });
};

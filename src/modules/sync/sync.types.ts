// src/modules/sync/sync.types.ts
//
// The contract this backend pushes to TeamOS.
//
// TeamOS validates every event with a zod schema of its own
// (TeamOS src/lib/wabmeta.ts). These types are the sending half of that same
// contract, and nothing links them: a field renamed on one side compiles
// cleanly on the other and fails at runtime with a 400. Change both, together.
//
// `id` is deliberately absent from the payload types below. It is the outbox
// row's id and is added when the request is built, so a retry of the same
// event does not change its fingerprint.

/** Where the receiving side files these clients. */
export const CATEGORY = {
  plan: 'WabMeta plan',
  refund: 'WabMeta refund',
  wallet: 'WabMeta wallet',
  offline: 'WabMeta offline',
} as const;

export type SyncKind = 'member.upsert' | 'client.upsert' | 'ledger.upsert';

/**
 * Events are applied in this order within a batch, because a payment names a
 * client and a client names its onboarder. Sending them the other way round
 * works too - TeamOS holds the payment for retry - but it wastes a round trip
 * and fills the log with failures that were never anybody's fault.
 */
export const KIND_ORDER: Record<SyncKind, number> = {
  'member.upsert': 0,
  'client.upsert': 1,
  'ledger.upsert': 2,
};

/** A person on the WabMeta admin team. Carries no role: TeamOS grants access itself. */
export interface MemberPayload {
  kind: 'member.upsert';
  externalId: string;
  name: string;
  email: string | null;
  title: string | null;
}

/** An organization, as a TeamOS client. */
export interface ClientPayload {
  kind: 'client.upsert';
  externalId: string;
  name: string;
  company: string | null;
  contact: string | null;
  since: string | null;
  /** Plan plus active monthly add-ons, in paise. */
  retainerPaise: number;
  /**
   * Who brought the client in, or null when nobody is credited: the sales
   * person who sold it, or - for clients an onboarder created themselves, which
   * is every client from before the sales role existed - that onboarder.
   */
  ownerExternalId: string | null;
  /**
   * Who is onboarding the client, or null before a sale is handed over. Often
   * the same person as the owner, for a client an onboarder brought in alone.
   */
  onboarderExternalId: string | null;
  removed: boolean;
}

/** One movement of money. */
export interface LedgerPayload {
  kind: 'ledger.upsert';
  externalId: string;
  type: 'in' | 'out';
  /** yyyy-MM-dd, in India time - the receiving workspace's zone. */
  date: string;
  description: string;
  category: string;
  amountPaise: number;
  status: 'paid' | 'pending';
  paidOn: string | null;
  method: string | null;
  clientExternalId: string | null;
  note: string | null;
}

export type SyncPayload = MemberPayload | ClientPayload | LedgerPayload;

/** What TeamOS answers for each event it was sent. */
export interface EventResult {
  id: string;
  status: 'applied' | 'unchanged' | 'failed';
  retry?: boolean;
  error?: string;
}

export interface SyncResponse {
  applied: number;
  unchanged: number;
  failed: number;
  results: EventResult[];
}

// ─── ids ───────────────────────────────────────────────────────────────────
//
// Built from our own primary keys, never from a Razorpay id: razorpayPaymentId
// is nullable on Payment, and an id that can be null cannot be a dedupe key.

export const memberExternalId = (adminUserId: string) => `admin:${adminUserId}`;
export const clientExternalId = (organizationId: string) => `org:${organizationId}`;
export const planExternalId = (paymentId: string) => `payment:${paymentId}`;
export const refundExternalId = (paymentId: string) => `refund:${paymentId}`;
export const walletExternalId = (transactionId: string) => `wallet:${transactionId}`;
export const offlineExternalId = (manualPaymentId: string) => `manual:${manualPaymentId}`;

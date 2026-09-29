// src/modules/meta/coexistence.ts
//
// Coexistence = number WhatsApp Business app par chalta rehta hai aur saath me
// Cloud API se bhi judta hai. Onboarding ke baad Meta khud purani chats ya
// contacts nahi bhejta - partner ko POST /{phone-number-id}/smb_app_data se
// maangna padta hai:
//   1. sync_type=smb_app_state_sync -> contacts (smb_app_state_sync webhooks)
//   2. sync_type=history            -> 180 din ki chats (history webhooks)
// Meta ke niyam: pehle contacts phir history, har type ek hi baar, aur
// onboarding ke 24 ghante ke andar - warna customer ko offboard karke dobara
// signup karwana padta hai.
// https://developers.facebook.com/documentation/business-messaging/whatsapp/embedded-signup/onboarding-business-app-users/
//
// Aane wale webhooks webhook.service.ts ke handleSmbStateSync /
// handleHistorySync save karte hain.

import prisma from '../../config/database';
import { metaApi } from './meta.api';
import { getAccountWithDecryptedToken } from '../../utils/tokenDecryption';
import { metaLog } from '../../utils/logger';

export const SYNC_WINDOW_MS = 24 * 60 * 60 * 1000;

export type SmbSyncType = 'smb_app_state_sync' | 'history';

export interface SmbSyncStep {
  requestedAt?: string;
  requestId?: string;
  error?: string;
  errorAt?: string;
}

export interface SmbSyncState {
  onboardedAt: string;
  contacts?: SmbSyncStep;
  history?: SmbSyncStep & {
    /** Business ne app me history sharing band rakhi (Meta error 2593109). */
    declined?: boolean;
    /** Aakhri history webhook ka phase (0-2) aur progress (0-100). */
    phase?: number;
    progress?: number;
    lastChunkAt?: string;
  };
}

const STEPS: { type: SmbSyncType; key: 'contacts' | 'history' }[] = [
  { type: 'smb_app_state_sync', key: 'contacts' },
  { type: 'history', key: 'history' },
];

export function readSyncState(raw: unknown): SmbSyncState | null {
  if (!raw || typeof raw !== 'object') return null;
  const s = raw as SmbSyncState;
  return s.onboardedAt ? s : null;
}

/** Jo step abhi tak kamyabi se maanga nahi gaya. */
export function pendingSteps(state: SmbSyncState | null): SmbSyncType[] {
  return STEPS.filter((s) => !state?.[s.key]?.requestedAt).map((s) => s.type);
}

export function windowOpen(state: SmbSyncState | null, now = Date.now()): boolean {
  if (!state) return false;
  return now - new Date(state.onboardedAt).getTime() < SYNC_WINDOW_MS;
}

/** Naya coexistence account - sync ki ghadi yahin se chalti hai. */
export async function markCoexistenceOnboarded(accountId: string): Promise<void> {
  const state: SmbSyncState = { onboardedAt: new Date().toISOString() };
  await prisma.whatsAppAccount.update({
    where: { id: accountId },
    data: { smbSyncState: state as any },
  });
}

/**
 * Jo sync abhi baaki hai use Meta se maango. Dobara chalana safe hai - jo step
 * ek baar maanga ja chuka hai use phir nahi bhejte (Meta dusri baar mana karta
 * hai). History tabhi maangi jaati hai jab contacts maange ja chuke hon.
 */
export async function runCoexistenceSync(accountId: string): Promise<{
  state: SmbSyncState | null;
  error?: string;
}> {
  const found = await getAccountWithDecryptedToken(accountId);
  if (!found) return { state: null, error: 'Account not connected' };

  const { account, accessToken } = found;
  let state = readSyncState((account as any).smbSyncState);
  if (!state) return { state: null, error: 'Not a coexistence account' };

  if (pendingSteps(state).length === 0) return { state };

  if (!windowOpen(state)) {
    return {
      state,
      error:
        'The 24-hour window to import chats has passed. Meta only allows it right after connecting - disconnect and connect the number again to retry.',
    };
  }

  let lastError: string | undefined;

  for (const step of STEPS) {
    if (state[step.key]?.requestedAt) continue;

    try {
      const { requestId } = await metaApi.requestSmbAppDataSync(
        account.phoneNumberId,
        accessToken,
        step.type
      );
      state = {
        ...state,
        [step.key]: { ...state[step.key], requestedAt: new Date().toISOString(), requestId: requestId ?? undefined, error: undefined },
      };
      metaLog.info('Coexistence sync requested', { accountId, syncType: step.type, requestId: requestId ?? undefined });
    } catch (err: any) {
      lastError = err?.message || `Failed to request ${step.type}`;
      state = {
        ...state,
        [step.key]: { ...state[step.key], error: lastError, errorAt: new Date().toISOString() },
      };
      metaLog.warn('Coexistence sync request failed', { accountId, syncType: step.type, error: lastError });
      break; // contacts fail hue to history mat maango - order zaroori hai
    }
  }

  await prisma.whatsAppAccount.update({
    where: { id: accountId },
    data: { smbSyncState: state as any },
  });

  return { state, error: lastError };
}

/** History webhook se aaye progress / decline ko state me likho. */
export async function recordHistoryProgress(
  accountId: string,
  patch: { phase?: number; progress?: number; declined?: boolean }
): Promise<void> {
  const row = await prisma.whatsAppAccount.findUnique({
    where: { id: accountId },
    select: { smbSyncState: true },
  });
  const state = readSyncState(row?.smbSyncState);
  if (!state) return;

  const next: SmbSyncState = {
    ...state,
    history: { ...state.history, ...patch, lastChunkAt: new Date().toISOString() },
  };
  await prisma.whatsAppAccount.update({
    where: { id: accountId },
    data: { smbSyncState: next as any },
  });
}

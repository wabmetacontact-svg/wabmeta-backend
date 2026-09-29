// Meta lets a partner ask for a coexistence number's contacts and chat history
// once per sync type, only within 24 hours of onboarding, and contacts before
// history. A second request is refused, a late one means re-onboarding - so
// the order, the once-only rule and the window must hold.

import { describe, it, expect, vi, beforeEach } from 'vitest';

const update = vi.fn();
const findUnique = vi.fn();
vi.mock('../../config/database', () => ({
  default: {
    whatsAppAccount: {
      update: (...a: any[]) => update(...a),
      findUnique: (...a: any[]) => findUnique(...a),
    },
  },
}));

const requestSmbAppDataSync = vi.fn();
vi.mock('./meta.api', () => ({
  metaApi: { requestSmbAppDataSync: (...a: any[]) => requestSmbAppDataSync(...a) },
}));

const getAccount = vi.fn();
vi.mock('../../utils/tokenDecryption', () => ({
  getAccountWithDecryptedToken: (...a: any[]) => getAccount(...a),
}));

import {
  pendingSteps,
  windowOpen,
  readSyncState,
  runCoexistenceSync,
  recordHistoryProgress,
  SYNC_WINDOW_MS,
} from './coexistence';

const HOUR = 60 * 60 * 1000;
const account = (smbSyncState: any) => ({
  account: { id: 'acc1', phoneNumberId: 'pn1', smbSyncState },
  accessToken: 'EAAtoken',
});
const savedState = () => update.mock.calls.at(-1)?.[0]?.data?.smbSyncState;

beforeEach(() => {
  update.mockReset();
  findUnique.mockReset();
  requestSmbAppDataSync.mockReset();
  getAccount.mockReset();
});

describe('sync state helpers', () => {
  it('ignores anything that is not a coexistence state', () => {
    expect(readSyncState(null)).toBeNull();
    expect(readSyncState({})).toBeNull();
    expect(readSyncState({ onboardedAt: '2026-09-29T00:00:00Z' })).not.toBeNull();
  });

  it('lists contacts before history, and only what was not requested', () => {
    const s = { onboardedAt: new Date().toISOString() };
    expect(pendingSteps(s)).toEqual(['smb_app_state_sync', 'history']);
    expect(pendingSteps({ ...s, contacts: { requestedAt: 'x' } })).toEqual(['history']);
    expect(pendingSteps({ ...s, contacts: { error: 'boom' } })).toEqual(['smb_app_state_sync', 'history']);
  });

  it('closes the window 24 hours after onboarding', () => {
    const t0 = Date.parse('2026-09-29T00:00:00Z');
    const s = { onboardedAt: new Date(t0).toISOString() };
    expect(windowOpen(s, t0 + 23 * HOUR)).toBe(true);
    expect(windowOpen(s, t0 + SYNC_WINDOW_MS)).toBe(false);
    expect(windowOpen(null, t0)).toBe(false);
  });
});

describe('runCoexistenceSync', () => {
  it('requests contacts then history and records both', async () => {
    getAccount.mockResolvedValue(account({ onboardedAt: new Date().toISOString() }));
    requestSmbAppDataSync.mockResolvedValueOnce({ requestId: 'r1' }).mockResolvedValueOnce({ requestId: 'r2' });

    const res = await runCoexistenceSync('acc1');

    expect(res.error).toBeUndefined();
    expect(requestSmbAppDataSync.mock.calls.map((c) => c[2])).toEqual(['smb_app_state_sync', 'history']);
    expect(requestSmbAppDataSync.mock.calls[0].slice(0, 2)).toEqual(['pn1', 'EAAtoken']);
    const s = savedState();
    expect(s.contacts.requestId).toBe('r1');
    expect(s.history.requestId).toBe('r2');
  });

  it('does not ask for history when contacts fail', async () => {
    getAccount.mockResolvedValue(account({ onboardedAt: new Date().toISOString() }));
    requestSmbAppDataSync.mockRejectedValueOnce(new Error('Meta says no'));

    const res = await runCoexistenceSync('acc1');

    expect(res.error).toBe('Meta says no');
    expect(requestSmbAppDataSync).toHaveBeenCalledTimes(1);
    expect(savedState().contacts.error).toBe('Meta says no');
    expect(savedState().history).toBeUndefined();
  });

  it('never re-requests a step that already went through', async () => {
    getAccount.mockResolvedValue(
      account({ onboardedAt: new Date().toISOString(), contacts: { requestedAt: 'x' } })
    );
    requestSmbAppDataSync.mockResolvedValue({ requestId: 'r2' });

    await runCoexistenceSync('acc1');

    expect(requestSmbAppDataSync.mock.calls.map((c) => c[2])).toEqual(['history']);
  });

  it('does nothing once both are requested', async () => {
    getAccount.mockResolvedValue(
      account({ onboardedAt: new Date().toISOString(), contacts: { requestedAt: 'x' }, history: { requestedAt: 'y' } })
    );
    const res = await runCoexistenceSync('acc1');
    expect(res.error).toBeUndefined();
    expect(requestSmbAppDataSync).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
  });

  it('refuses after the 24-hour window without calling Meta', async () => {
    getAccount.mockResolvedValue(
      account({ onboardedAt: new Date(Date.now() - 25 * HOUR).toISOString() })
    );
    const res = await runCoexistenceSync('acc1');
    expect(res.error).toMatch(/24-hour window/);
    expect(requestSmbAppDataSync).not.toHaveBeenCalled();
  });

  it('refuses a number that did not come in through coexistence', async () => {
    getAccount.mockResolvedValue(account(null));
    const res = await runCoexistenceSync('acc1');
    expect(res.error).toBe('Not a coexistence account');
    expect(requestSmbAppDataSync).not.toHaveBeenCalled();
  });
});

describe('recordHistoryProgress', () => {
  it('merges progress into the stored state', async () => {
    findUnique.mockResolvedValue({
      smbSyncState: { onboardedAt: 'x', history: { requestedAt: 'y' } },
    });
    await recordHistoryProgress('acc1', { phase: 1, progress: 40 });
    const s = savedState();
    expect(s.history).toMatchObject({ requestedAt: 'y', phase: 1, progress: 40 });
  });
});

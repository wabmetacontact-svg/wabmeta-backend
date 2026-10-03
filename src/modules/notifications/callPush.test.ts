/**
 * WhatsApp call pushes: Android apps get data-only messages (the app rings the
 * call itself), other devices an ordinary notification. Expo and the database
 * are stubbed.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const sent = vi.hoisted(() => [] as any[]);
vi.mock('expo-server-sdk', () => {
  class Expo {
    static isExpoPushToken = (t: string) => t.startsWith('ExponentPushToken[');
    chunkPushNotifications = (m: any[]) => [m];
    sendPushNotificationsAsync = async (chunk: any[]) => {
      sent.push(...chunk);
      return chunk.map(() => ({ status: 'ok' }));
    };
  }
  return { Expo };
});

const tokens = vi.hoisted(() => [] as { userId: string; token: string; platform: string | null }[]);
vi.mock('../../config/database', () => ({
  default: {
    expoPushToken: {
      findMany: vi.fn(async ({ where }: any) => tokens.filter((t) => where.userId.in.includes(t.userId))),
    },
  },
}));

import { notificationsService } from './notifications.service';

beforeEach(() => {
  sent.length = 0;
  tokens.length = 0;
  tokens.push(
    { userId: 'u1', token: 'ExponentPushToken[android-1]', platform: 'android' },
    { userId: 'u1', token: 'ExponentPushToken[ios-1]', platform: 'ios' },
    { userId: 'u2', token: 'ExponentPushToken[old-2]', platform: null },
    { userId: 'u3', token: 'ExponentPushToken[android-3]', platform: 'android' }
  );
});

describe('call pushes', () => {
  it('ring Android apps data-only and other devices with a notification', async () => {
    const data = { type: 'incoming_call', callId: 'wacid.1', callerName: 'Asha' };
    await notificationsService.sendCallPush(['u1', 'u2'], data, { title: 'Incoming', body: 'Asha is calling' });

    const byToken = Object.fromEntries(sent.map((m) => [m.to, m]));
    expect(Object.keys(byToken).sort()).toEqual(['ExponentPushToken[android-1]', 'ExponentPushToken[ios-1]', 'ExponentPushToken[old-2]']);

    // No title / body: Android hands it to the app instead of showing it
    expect(byToken['ExponentPushToken[android-1]']).toEqual({ to: 'ExponentPushToken[android-1]', data, priority: 'high', ttl: 60 });
    expect(byToken['ExponentPushToken[ios-1]']).toMatchObject({ title: 'Incoming', body: 'Asha is calling', data, ttl: 60 });
    expect(byToken['ExponentPushToken[old-2]']).toMatchObject({ title: 'Incoming' });
  });

  it('send "stop ringing" to Android apps only', async () => {
    await notificationsService.sendCallPush(['u1', 'u2', 'u3'], { type: 'call_ended', callId: 'wacid.1' });
    expect(sent.map((m) => m.to).sort()).toEqual(['ExponentPushToken[android-1]', 'ExponentPushToken[android-3]']);
    expect(sent.every((m) => !m.title && m.data.type === 'call_ended')).toBe(true);
  });
});

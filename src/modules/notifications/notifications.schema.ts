import { z } from 'zod';

export const registerPushTokenSchema = z.object({
  body: z.object({
    token: z.string().min(1, 'Token is required'),
    deviceId: z.string().optional(),
    platform: z.enum(['ios', 'android']).optional(),
  }),
});

export const listNotificationsSchema = z.object({
  query: z.object({
    filter: z.enum(['all', 'unread']).optional().default('all'),
    type: z.string().optional(),
    page: z.string().optional().default('1'),
    limit: z.string().optional().default('50'),
  }),
});

export const notificationIdSchema = z.object({
  params: z.object({
    id: z.string().min(1),
  }),
});

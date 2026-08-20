export type NotificationType =
  | 'message'
  | 'campaign'
  | 'team'
  | 'billing'
  | 'alert'
  | 'whatsapp'
  | 'system';

export interface CreateNotificationInput {
  userId: string;
  type: NotificationType;
  title: string;
  description: string;
  actionUrl?: string;
  metadata?: Record<string, any>;
  sendPush?: boolean; // default true
}

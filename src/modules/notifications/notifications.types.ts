export type NotificationType =
  | 'message'
  | 'campaign'
  | 'team'
  | 'billing'
  | 'billing_warning'
  | 'wallet'
  | 'new_lead'
  | 'alert'
  | 'whatsapp'
  | 'system';

export interface CreateNotificationInput {
  userId: string;
  organizationId?: string;
  type: NotificationType;
  title: string;
  description: string;
  actionUrl?: string;
  metadata?: Record<string, any>;
  sendPush?: boolean; // default true
}

import { Router } from 'express';
import { notificationsController } from './notifications.controller';
import { authenticate } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import {
  registerPushTokenSchema,
  listNotificationsSchema,
  notificationIdSchema,
} from './notifications.schema';

const router = Router();

router.use(authenticate);

router.get('/', validate(listNotificationsSchema), notificationsController.list);
router.get('/unread-count', notificationsController.unreadCount);
router.patch('/mark-all-read', notificationsController.markAllAsRead);
router.delete('/clear-all', notificationsController.clearAll);
router.patch('/:id/read', validate(notificationIdSchema), notificationsController.markAsRead);
router.delete('/:id', validate(notificationIdSchema), notificationsController.delete);

// Push token
router.post('/push-token', validate(registerPushTokenSchema), notificationsController.registerPushToken);
router.delete('/push-token', notificationsController.removePushToken);

export default router;

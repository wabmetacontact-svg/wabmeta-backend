// src/modules/chatbot/chatbot.routes.ts

import { Router } from 'express';
import { chatbotController } from './chatbot.controller';
import { authenticate } from '../../middleware/auth';
import { requireActiveSubscription, checkChatbotLimit } from '../../middleware/planLimits';

const router = Router();

router.use(authenticate);

router.get('/', chatbotController.getAll.bind(chatbotController));

router.post(
  '/',
  requireActiveSubscription,
  checkChatbotLimit,
  chatbotController.create.bind(chatbotController)
);

router.get('/:id', chatbotController.getById.bind(chatbotController));
router.put('/:id', chatbotController.update.bind(chatbotController));
router.delete('/:id', chatbotController.delete.bind(chatbotController));
router.post('/:id/activate', chatbotController.activate.bind(chatbotController));
router.post('/:id/deactivate', chatbotController.deactivate.bind(chatbotController));
router.post('/:id/duplicate', chatbotController.duplicate.bind(chatbotController));

export default router;
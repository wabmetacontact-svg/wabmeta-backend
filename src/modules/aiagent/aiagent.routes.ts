// src/modules/aiagent/aiagent.routes.ts - mounted at /api/ai-agent

import { Router } from 'express';
import { aiAgentController } from './aiagent.controller';
import { authenticate } from '../../middleware/auth';
import { gateMutations, OPERATOR_ROLES } from '../../middleware/requireRole';
import { featureLock } from '../../middleware/featureLock';

const router = Router();

router.use(authenticate);

// AI agent chatbot feature ka hissa hai - jis plan me chatbot band, wahan ye bhi
router.use(featureLock('chatbot'));

// Writes are role-gated; reads stay open to every member including VIEWER.
router.use(gateMutations(...OPERATOR_ROLES));

router.get('/settings', aiAgentController.getSettings);
router.put('/settings', aiAgentController.updateSettings);

router.get('/knowledge', aiAgentController.listKnowledge);
router.post('/knowledge', aiAgentController.createKnowledge);
router.put('/knowledge/:id', aiAgentController.updateKnowledge);
router.delete('/knowledge/:id', aiAgentController.deleteKnowledge);

// Dry run - no WhatsApp message, no CRM writes
router.post('/test', aiAgentController.test);

export default router;

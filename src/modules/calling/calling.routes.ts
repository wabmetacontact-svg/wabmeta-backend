// src/modules/calling/calling.routes.ts

import { Router } from 'express';
import { callingController } from './calling.controller';
import { authenticate } from '../../middleware/auth';

const router = Router();

// All routes protected
router.use(authenticate);

// Calling Settings
router.get('/settings', callingController.getSettings.bind(callingController));
router.put('/settings', callingController.updateSettings.bind(callingController));

// Initiate Call
router.post('/initiate', callingController.initiateCall.bind(callingController));

// Call Logs
router.get('/logs', callingController.getCallLogs.bind(callingController));

export default router;

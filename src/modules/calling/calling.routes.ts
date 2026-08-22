// src/modules/calling/calling.routes.ts

import { Router } from 'express';
import { callingController } from './calling.controller';
import { authenticate } from '../../middleware/auth';

import { gateMutations, ADMIN_ROLES } from '../../middleware/requireRole';
const router = Router();

// All routes protected
router.use(authenticate);

// Writes are role-gated; reads stay open to every member including VIEWER.
router.use(gateMutations(...ADMIN_ROLES));

// Calling Settings
router.get('/settings', callingController.getSettings.bind(callingController));
router.put('/settings', callingController.updateSettings.bind(callingController));

// Initiate Call
router.post('/initiate', callingController.initiateCall.bind(callingController));

// Call Logs
router.get('/logs', callingController.getCallLogs.bind(callingController));

export default router;

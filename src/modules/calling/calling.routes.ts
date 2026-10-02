// src/modules/calling/calling.routes.ts

import { Router } from 'express';
import { callingController as c } from './calling.controller';
import { authenticate } from '../../middleware/auth';
import { requireRole, ADMIN_ROLES, OPERATOR_ROLES } from '../../middleware/requireRole';

const router = Router();

// All routes protected
router.use(authenticate);

// Calling settings on the WhatsApp number: owners and admins change them.
router.get('/settings', c.getSettings.bind(c));
router.put('/settings', requireRole(...ADMIN_ROLES), c.updateSettings.bind(c));

// Whether the number can use calling (Meta's 2,000 messaging limit, country)
router.get('/eligibility', c.eligibility.bind(c));

// Calls. Answering and placing calls is day-to-day work, so every member
// except a viewer may do it.
router.get('/active', c.activeCalls.bind(c));
router.post('/start', requireRole(...OPERATOR_ROLES), c.startCall.bind(c));
router.post('/:callId/accept', requireRole(...OPERATOR_ROLES), c.acceptCall.bind(c));
router.post('/:callId/reject', requireRole(...OPERATOR_ROLES), c.rejectCall.bind(c));
router.post('/:callId/terminate', requireRole(...OPERATOR_ROLES), c.terminateCall.bind(c));

// The customer's permission for us to call them
router.get('/permission', c.getPermission.bind(c));
router.post('/permission-request', requireRole(...OPERATOR_ROLES), c.requestPermission.bind(c));

// Call history
router.get('/logs', c.getCallLogs.bind(c));

export default router;

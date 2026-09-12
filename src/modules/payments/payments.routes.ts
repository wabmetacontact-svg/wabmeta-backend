// src/modules/payments/payments.routes.ts - mounted at /api/payments

import { Router } from 'express';
import { paymentsController } from './payments.controller';
import { authenticate } from '../../middleware/auth';
import { gateMutations, OPERATOR_ROLES } from '../../middleware/requireRole';

const router = Router();

router.use(authenticate);

// Writes are role-gated; reads stay open to every member including VIEWER.
router.use(gateMutations(...OPERATOR_ROLES));

// Client ka apna Razorpay account
router.get('/gateway', paymentsController.getGateway);
router.put('/gateway', paymentsController.connectGateway);
router.delete('/gateway', paymentsController.disconnectGateway);

// Payment links
router.get('/', paymentsController.listRecent);
router.post('/links', paymentsController.createLink);
router.get('/leads/:leadId', paymentsController.listForLead);
router.post('/:id/refresh', paymentsController.refresh);
router.post('/:id/resend', paymentsController.resend);

export default router;

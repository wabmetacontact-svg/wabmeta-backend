// ✅ CREATE: src/modules/crm/crm.routes.ts

import { Router } from 'express';
import { crmController } from './crm.controller';
import { authenticate } from '../../middleware/auth';

const router = Router();

router.use(authenticate);

// Stats
router.get('/stats', crmController.getStats.bind(crmController));
router.post('/sync-from-contacts', crmController.syncFromContacts.bind(crmController));

// Pipelines
router.get('/pipelines', crmController.getPipelines.bind(crmController));
router.post('/pipelines', crmController.createPipeline.bind(crmController));

// Leads
router.get('/leads', crmController.getLeads.bind(crmController));
router.post('/leads', crmController.createLead.bind(crmController));
router.get('/leads/:id', crmController.getLeadById.bind(crmController));
router.put('/leads/:id', crmController.updateLead.bind(crmController));
router.delete('/leads/:id', crmController.deleteLead.bind(crmController));

// Lead Notes
router.get('/leads/:id/notes', crmController.getLeadNotes.bind(crmController));
router.post('/leads/:id/notes', crmController.addLeadNote.bind(crmController));

// Lead Tasks
router.post('/leads/:id/tasks', crmController.addLeadTask.bind(crmController));
router.put('/tasks/:taskId/complete', crmController.completeTask.bind(crmController));

// Contact Notes
router.get('/contacts/:contactId/notes', crmController.getContactNotes.bind(crmController));
router.post('/contacts/:contactId/notes', crmController.addContactNote.bind(crmController));

export default router;
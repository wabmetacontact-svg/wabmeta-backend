"use strict";
// ✅ CREATE: src/modules/crm/crm.routes.ts
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const crm_controller_1 = require("./crm.controller");
const auth_1 = require("../../middleware/auth");
const router = (0, express_1.Router)();
router.use(auth_1.authenticate);
// Stats
router.get('/stats', crm_controller_1.crmController.getStats.bind(crm_controller_1.crmController));
router.post('/sync-from-contacts', crm_controller_1.crmController.syncFromContacts.bind(crm_controller_1.crmController));
// Pipelines
router.get('/pipelines', crm_controller_1.crmController.getPipelines.bind(crm_controller_1.crmController));
router.post('/pipelines', crm_controller_1.crmController.createPipeline.bind(crm_controller_1.crmController));
// Leads
router.get('/leads', crm_controller_1.crmController.getLeads.bind(crm_controller_1.crmController));
router.post('/leads', crm_controller_1.crmController.createLead.bind(crm_controller_1.crmController));
router.get('/leads/:id', crm_controller_1.crmController.getLeadById.bind(crm_controller_1.crmController));
router.put('/leads/:id', crm_controller_1.crmController.updateLead.bind(crm_controller_1.crmController));
router.delete('/leads/:id', crm_controller_1.crmController.deleteLead.bind(crm_controller_1.crmController));
// Lead Notes
router.get('/leads/:id/notes', crm_controller_1.crmController.getLeadNotes.bind(crm_controller_1.crmController));
router.post('/leads/:id/notes', crm_controller_1.crmController.addLeadNote.bind(crm_controller_1.crmController));
// Lead Tasks
router.post('/leads/:id/tasks', crm_controller_1.crmController.addLeadTask.bind(crm_controller_1.crmController));
router.put('/tasks/:taskId/complete', crm_controller_1.crmController.completeTask.bind(crm_controller_1.crmController));
// Contact Notes
router.get('/contacts/:contactId/notes', crm_controller_1.crmController.getContactNotes.bind(crm_controller_1.crmController));
router.post('/contacts/:contactId/notes', crm_controller_1.crmController.addContactNote.bind(crm_controller_1.crmController));
exports.default = router;
//# sourceMappingURL=crm.routes.js.map
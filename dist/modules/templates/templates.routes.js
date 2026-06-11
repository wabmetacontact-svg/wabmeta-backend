"use strict";
// src/modules/templates/templates.routes.ts
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const templates_controller_1 = require("./templates.controller");
const auth_1 = require("../../middleware/auth");
const templates_media_1 = require("./templates.media");
const router = (0, express_1.Router)();
// All routes require authentication
router.use(auth_1.authenticate);
// ✅ CRITICAL: Media upload MUST be BEFORE /:id routes
router.post('/upload-media', templates_media_1.uploadMiddleware.single('file'), templates_media_1.uploadTemplateMedia);
// Template CRUD & Operations
router.post('/', templates_controller_1.templatesController.create.bind(templates_controller_1.templatesController));
router.get('/', templates_controller_1.templatesController.getList.bind(templates_controller_1.templatesController));
router.get('/stats', templates_controller_1.templatesController.getStats.bind(templates_controller_1.templatesController));
router.get('/approved', templates_controller_1.templatesController.getApproved.bind(templates_controller_1.templatesController));
router.get('/languages', templates_controller_1.templatesController.getLanguages.bind(templates_controller_1.templatesController));
router.get('/check-connection', templates_controller_1.templatesController.checkConnection.bind(templates_controller_1.templatesController));
router.post('/sync', templates_controller_1.templatesController.sync.bind(templates_controller_1.templatesController));
router.post('/preview', templates_controller_1.templatesController.preview.bind(templates_controller_1.templatesController));
router.post('/upload-to-meta', templates_controller_1.templatesController.uploadToMeta.bind(templates_controller_1.templatesController));
// Specific template routes (MUST be AFTER other routes)
router.get('/:id', templates_controller_1.templatesController.getById.bind(templates_controller_1.templatesController));
router.put('/:id', templates_controller_1.templatesController.update.bind(templates_controller_1.templatesController));
router.delete('/:id', templates_controller_1.templatesController.delete.bind(templates_controller_1.templatesController));
router.post('/:id/submit', templates_controller_1.templatesController.submit.bind(templates_controller_1.templatesController));
router.post('/:id/duplicate', templates_controller_1.templatesController.duplicate.bind(templates_controller_1.templatesController));
router.post('/:id/reupload-media', templates_controller_1.templatesController.reuploadMedia.bind(templates_controller_1.templatesController));
router.post('/:id/fix-media', templates_media_1.uploadMiddleware.single('file'), templates_controller_1.templatesController.fixMedia.bind(templates_controller_1.templatesController));
exports.default = router;
//# sourceMappingURL=templates.routes.js.map
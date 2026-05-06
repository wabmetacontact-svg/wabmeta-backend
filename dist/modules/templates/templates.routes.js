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
router.post('/', templates_controller_1.templatesController.create);
router.get('/', templates_controller_1.templatesController.getList);
router.get('/stats', templates_controller_1.templatesController.getStats);
router.get('/approved', templates_controller_1.templatesController.getApproved);
router.get('/languages', templates_controller_1.templatesController.getLanguages);
router.get('/check-connection', templates_controller_1.templatesController.checkConnection);
router.post('/sync', templates_controller_1.templatesController.sync);
router.post('/preview', templates_controller_1.templatesController.preview);
router.post('/upload-to-meta', templates_controller_1.templatesController.uploadToMeta);
// Specific template routes (MUST be AFTER other routes)
router.get('/:id', templates_controller_1.templatesController.getById);
router.put('/:id', templates_controller_1.templatesController.update);
router.delete('/:id', templates_controller_1.templatesController.delete);
router.post('/:id/submit', templates_controller_1.templatesController.submit);
router.post('/:id/duplicate', templates_controller_1.templatesController.duplicate);
router.post('/:id/reupload-media', templates_controller_1.templatesController.reuploadMedia);
router.post('/:id/fix-media', templates_media_1.uploadMiddleware.single('file'), templates_controller_1.templatesController.fixMedia);
exports.default = router;
//# sourceMappingURL=templates.routes.js.map
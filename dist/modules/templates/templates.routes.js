"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// src/modules/templates/templates.routes.ts - FINAL
const express_1 = require("express");
const templates_controller_1 = require("./templates.controller");
const auth_1 = require("../../middleware/auth");
const validate_1 = require("../../middleware/validate");
const planLimits_1 = require("../../middleware/planLimits");
const templates_media_1 = require("./templates.media");
const templates_schema_1 = require("./templates.schema");
const router = (0, express_1.Router)();
// All routes require auth
router.use(auth_1.authenticate);
// ─── Static routes (MUST be before /:id) ─────────────────────
// ✅ Upload media - templates.media.ts handler directly
router.post('/upload-media', templates_media_1.uploadMiddleware.single('file'), templates_media_1.uploadTemplateMedia // ← Direct, no controller wrapper
);
// Helper - upload to Meta from URL (re-upload flow)
router.post('/upload-to-meta', (0, validate_1.validate)(templates_schema_1.uploadToMetaSchema), templates_controller_1.templatesController.uploadToMeta.bind(templates_controller_1.templatesController));
// Preview
router.post('/preview', (0, validate_1.validate)(templates_schema_1.previewTemplateSchema), templates_controller_1.templatesController.preview.bind(templates_controller_1.templatesController));
// Sync from Meta
router.post('/sync', (0, validate_1.validate)(templates_schema_1.syncTemplatesSchema), templates_controller_1.templatesController.sync.bind(templates_controller_1.templatesController));
// Read-only static
router.get('/stats', templates_controller_1.templatesController.getStats.bind(templates_controller_1.templatesController));
router.get('/approved', templates_controller_1.templatesController.getApproved.bind(templates_controller_1.templatesController));
router.get('/languages', templates_controller_1.templatesController.getLanguages.bind(templates_controller_1.templatesController));
router.get('/check-connection', templates_controller_1.templatesController.checkConnection.bind(templates_controller_1.templatesController));
// ─── Main CRUD ────────────────────────────────────────────────
// Create
router.post('/', (0, planLimits_1.checkPlanLimit)('templates'), (0, validate_1.validate)(templates_schema_1.createTemplateSchema), templates_controller_1.templatesController.create.bind(templates_controller_1.templatesController));
// List
router.get('/', (0, validate_1.validate)(templates_schema_1.getTemplatesQuerySchema), templates_controller_1.templatesController.getList.bind(templates_controller_1.templatesController));
// ─── Dynamic routes (MUST be after static) ───────────────────
router.get('/:id', templates_controller_1.templatesController.getById.bind(templates_controller_1.templatesController));
router.put('/:id', (0, validate_1.validate)(templates_schema_1.updateTemplateSchema), templates_controller_1.templatesController.update.bind(templates_controller_1.templatesController));
router.delete('/:id', templates_controller_1.templatesController.delete.bind(templates_controller_1.templatesController));
router.post('/:id/submit', (0, validate_1.validate)(templates_schema_1.submitTemplateSchema), templates_controller_1.templatesController.submit.bind(templates_controller_1.templatesController));
router.post('/:id/duplicate', (0, validate_1.validate)(templates_schema_1.duplicateTemplateSchema), templates_controller_1.templatesController.duplicate.bind(templates_controller_1.templatesController));
// Re-upload from existing Cloudinary URL
router.post('/:id/reupload-media', templates_controller_1.templatesController.reuploadMedia.bind(templates_controller_1.templatesController));
// Fix broken template (fresh file upload)
router.post('/:id/fix-media', templates_media_1.uploadMiddleware.single('file'), templates_controller_1.templatesController.fixMedia.bind(templates_controller_1.templatesController));
exports.default = router;
//# sourceMappingURL=templates.routes.js.map
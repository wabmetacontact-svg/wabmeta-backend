// src/modules/templates/templates.routes.ts - FINAL
import { Router } from 'express';
import { templatesController } from './templates.controller';
import { authenticate } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { checkPlanLimit } from '../../middleware/planLimits';
import { uploadMiddleware, uploadTemplateMedia } from './templates.media';
import {
  createTemplateSchema,
  updateTemplateSchema,
  duplicateTemplateSchema,
  submitTemplateSchema,
  previewTemplateSchema,
  syncTemplatesSchema,
  getTemplatesQuerySchema,
  uploadToMetaSchema,
} from './templates.schema';

const router = Router();

// All routes require auth
router.use(authenticate);

// ─── Static routes (MUST be before /:id) ─────────────────────

// ✅ Upload media - templates.media.ts handler directly
router.post(
  '/upload-media',
  uploadMiddleware.single('file'),
  uploadTemplateMedia  // ← Direct, no controller wrapper
);

// Helper - upload to Meta from URL (re-upload flow)
router.post(
  '/upload-to-meta',
  validate(uploadToMetaSchema),
  templatesController.uploadToMeta.bind(templatesController)
);

// Preview
router.post(
  '/preview',
  validate(previewTemplateSchema),
  templatesController.preview.bind(templatesController)
);

// Sync from Meta
router.post(
  '/sync',
  validate(syncTemplatesSchema),
  templatesController.sync.bind(templatesController)
);

// Read-only static
router.get(
  '/stats',
  templatesController.getStats.bind(templatesController)
);
router.get(
  '/approved',
  templatesController.getApproved.bind(templatesController)
);
router.get(
  '/languages',
  templatesController.getLanguages.bind(templatesController)
);
router.get(
  '/check-connection',
  templatesController.checkConnection.bind(templatesController)
);

// ─── Main CRUD ────────────────────────────────────────────────

// Create
router.post(
  '/',
  checkPlanLimit('templates'),
  validate(createTemplateSchema),
  templatesController.create.bind(templatesController)
);

// List
router.get(
  '/',
  validate(getTemplatesQuerySchema),
  templatesController.getList.bind(templatesController)
);

// ─── Dynamic routes (MUST be after static) ───────────────────

router.get(
  '/:id',
  templatesController.getById.bind(templatesController)
);
router.put(
  '/:id',
  validate(updateTemplateSchema),
  templatesController.update.bind(templatesController)
);
router.delete(
  '/:id',
  templatesController.delete.bind(templatesController)
);
router.post(
  '/:id/submit',
  validate(submitTemplateSchema),
  templatesController.submit.bind(templatesController)
);
router.post(
  '/:id/duplicate',
  validate(duplicateTemplateSchema),
  templatesController.duplicate.bind(templatesController)
);

// Re-upload from existing Cloudinary URL
router.post(
  '/:id/reupload-media',
  templatesController.reuploadMedia.bind(templatesController)
);

// Fix broken template (fresh file upload)
router.post(
  '/:id/fix-media',
  uploadMiddleware.single('file'),
  templatesController.fixMedia.bind(templatesController)
);

export default router;
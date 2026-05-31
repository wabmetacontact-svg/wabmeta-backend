// src/modules/templates/templates.routes.ts

import { Router } from 'express';
import { templatesController } from './templates.controller';
import { authenticate } from '../../middleware/auth';
import { uploadMiddleware, uploadTemplateMedia } from './templates.media';

const router = Router();

// All routes require authentication
router.use(authenticate);

// ✅ CRITICAL: Media upload MUST be BEFORE /:id routes
router.post('/upload-media', uploadMiddleware.single('file'), uploadTemplateMedia);

// Template CRUD & Operations
router.post('/', templatesController.create.bind(templatesController));
router.get('/', templatesController.getList.bind(templatesController));
router.get('/stats', templatesController.getStats.bind(templatesController));
router.get('/approved', templatesController.getApproved.bind(templatesController));
router.get('/languages', templatesController.getLanguages.bind(templatesController));
router.get('/check-connection', templatesController.checkConnection.bind(templatesController));
router.post('/sync', templatesController.sync.bind(templatesController));
router.post('/preview', templatesController.preview.bind(templatesController));
router.post('/upload-to-meta', templatesController.uploadToMeta.bind(templatesController));

// Specific template routes (MUST be AFTER other routes)
router.get('/:id', templatesController.getById.bind(templatesController));
router.put('/:id', templatesController.update.bind(templatesController));
router.delete('/:id', templatesController.delete.bind(templatesController));
router.post('/:id/submit', templatesController.submit.bind(templatesController));
router.post('/:id/duplicate', templatesController.duplicate.bind(templatesController));
router.post('/:id/reupload-media', templatesController.reuploadMedia.bind(templatesController));
router.post('/:id/fix-media', uploadMiddleware.single('file'), templatesController.fixMedia.bind(templatesController));

export default router;
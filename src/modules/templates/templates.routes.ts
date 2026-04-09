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
router.post('/', templatesController.create);
router.get('/', templatesController.getList);
router.get('/stats', templatesController.getStats);
router.get('/approved', templatesController.getApproved);
router.get('/languages', templatesController.getLanguages);
router.get('/check-connection', templatesController.checkConnection);
router.post('/sync', templatesController.sync);
router.post('/preview', templatesController.preview);
router.post('/upload-to-meta', templatesController.uploadToMeta);

// Specific template routes (MUST be AFTER other routes)
router.get('/:id', templatesController.getById);
router.put('/:id', templatesController.update);
router.delete('/:id', templatesController.delete);
router.post('/:id/submit', templatesController.submit);
router.post('/:id/duplicate', templatesController.duplicate);
router.post('/:id/reupload-media', templatesController.reuploadMedia);
router.post('/:id/fix-media', uploadMiddleware.single('file'), templatesController.fixMedia);

export default router;
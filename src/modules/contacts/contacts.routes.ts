// src/modules/contacts/contacts.routes.ts - COMPLETE FIXED

import { Router } from 'express';
import multer from 'multer';
import { contactsController } from './contacts.controller';
import { authenticate } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { requireActiveSubscription, checkContactLimit } from '../../middleware/planLimits';
import {
  createContactSchema,
  updateContactSchema,
  importContactsSchema,
  bulkUpdateSchema,
  bulkDeleteSchema,
  createContactGroupSchema,
  updateContactGroupSchema,
  addContactsToGroupSchema,
} from './contacts.schema';

import { contactsImportMiddleware } from './contacts.import.middleware';

const router = Router();
// Multer config for CSV upload
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'text/csv' ||
      file.originalname.endsWith('.csv') ||
      file.mimetype === 'application/vnd.ms-excel') {
      cb(null, true);
    } else {
      cb(new Error('Only CSV files are allowed'));
    }
  },
});

// All routes require authentication
router.use(authenticate);

// ============================================
// FEATURE ACCESS & COMMON
// ============================================

router.get('/feature-access', contactsController.getFeatureAccess.bind(contactsController));
router.get('/country-codes', contactsController.getCountryCodes.bind(contactsController));

// ============================================
// CONTACT ROUTES (STATIC FIRST)
// ============================================

router.get('/stats', contactsController.getStats.bind(contactsController));
router.get('/import-stats', contactsController.getImportStats.bind(contactsController));
router.get('/tags', contactsController.getTags.bind(contactsController));
router.get('/export', contactsController.export.bind(contactsController));

router.post('/refresh-profiles/batch', contactsController.refreshUnknownNames.bind(contactsController));
router.post('/refresh-names', contactsController.refreshUnknownNames.bind(contactsController));

// ============================================
// CONTACT GROUP ROUTES (MUST BE BEFORE /:id)
// ============================================

router.get('/groups/all', contactsController.getGroups.bind(contactsController));

router.post('/groups', validate(createContactGroupSchema), contactsController.createGroup.bind(contactsController));
router.get('/groups/:groupId', contactsController.getGroupById.bind(contactsController));

router.patch('/groups/:groupId', validate(updateContactGroupSchema), contactsController.updateGroup.bind(contactsController));
router.delete('/groups/:groupId', contactsController.deleteGroup.bind(contactsController));

router.get('/groups/:groupId/contacts', contactsController.getGroupContacts.bind(contactsController));

router.post(
  '/groups/:groupId/contacts',
  validate(addContactsToGroupSchema),
  contactsController.addContactsToGroup.bind(contactsController)
);

router.delete(
  '/groups/:groupId/contacts',
  validate(addContactsToGroupSchema),
  contactsController.removeContactsFromGroup.bind(contactsController)
);

// ============================================
// LIST / CREATE / IMPORT / BULK
// ============================================

router.get('/', contactsController.getList.bind(contactsController));
router.post('/', validate(createContactSchema), requireActiveSubscription, checkContactLimit, contactsController.create.bind(contactsController));

// Import contacts - with file upload
router.post('/import', requireActiveSubscription, upload.single('file'), (req, res, next) => {
  contactsController.import(req, res, next);
});

// ✅ Simple Bulk Paste (₹2,500+)
router.post('/bulk-paste', contactsController.simpleBulkPaste.bind(contactsController));

// ✅ CSV Upload (₹899+)
router.post('/csv-upload', contactsController.csvUpload.bind(contactsController));

router.patch('/bulk', validate(bulkUpdateSchema), contactsController.bulkUpdate.bind(contactsController));
router.delete('/bulk', validate(bulkDeleteSchema), contactsController.bulkDelete.bind(contactsController));
router.delete('/all', contactsController.deleteAll.bind(contactsController));

// ============================================
// CONTACT BY ID (LAST)
// ============================================

router.get('/:id', contactsController.getById.bind(contactsController));

router.patch('/:id', validate(updateContactSchema), contactsController.update.bind(contactsController));
router.delete('/:id', contactsController.delete.bind(contactsController));

export default router;
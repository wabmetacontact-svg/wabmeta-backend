"use strict";
// src/modules/contacts/contacts.routes.ts - COMPLETE FIXED
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const multer_1 = __importDefault(require("multer"));
const contacts_controller_1 = require("./contacts.controller");
const auth_1 = require("../../middleware/auth");
const validate_1 = require("../../middleware/validate");
const planLimits_1 = require("../../middleware/planLimits");
const contacts_schema_1 = require("./contacts.schema");
const router = (0, express_1.Router)();
// Multer config for CSV upload
const upload = (0, multer_1.default)({
    storage: multer_1.default.memoryStorage(),
    limits: {
        fileSize: 10 * 1024 * 1024, // 10MB limit
    },
    fileFilter: (req, file, cb) => {
        if (file.mimetype === 'text/csv' ||
            file.originalname.endsWith('.csv') ||
            file.mimetype === 'application/vnd.ms-excel') {
            cb(null, true);
        }
        else {
            cb(new Error('Only CSV files are allowed'));
        }
    },
});
// All routes require authentication
router.use(auth_1.authenticate);
// ============================================
// FEATURE ACCESS & COMMON
// ============================================
router.get('/feature-access', contacts_controller_1.contactsController.getFeatureAccess.bind(contacts_controller_1.contactsController));
router.get('/country-codes', contacts_controller_1.contactsController.getCountryCodes.bind(contacts_controller_1.contactsController));
// ============================================
// CONTACT ROUTES (STATIC FIRST)
// ============================================
router.get('/stats', contacts_controller_1.contactsController.getStats.bind(contacts_controller_1.contactsController));
router.get('/import-stats', contacts_controller_1.contactsController.getImportStats.bind(contacts_controller_1.contactsController));
// Audience count (for campaign creation)
router.get('/audience-count', contacts_controller_1.contactsController.getAudienceCount.bind(contacts_controller_1.contactsController));
// Contact search (for manual selection)
router.get('/search', contacts_controller_1.contactsController.searchContacts.bind(contacts_controller_1.contactsController));
router.get('/tags', contacts_controller_1.contactsController.getTags.bind(contacts_controller_1.contactsController));
router.get('/export', contacts_controller_1.contactsController.export.bind(contacts_controller_1.contactsController));
router.post('/refresh-profiles/batch', contacts_controller_1.contactsController.refreshUnknownNames.bind(contacts_controller_1.contactsController));
router.post('/refresh-names', contacts_controller_1.contactsController.refreshUnknownNames.bind(contacts_controller_1.contactsController));
// ============================================
// CONTACT GROUP ROUTES (MUST BE BEFORE /:id)
// ============================================
router.get('/groups/all', contacts_controller_1.contactsController.getGroups.bind(contacts_controller_1.contactsController));
router.post('/groups', (0, validate_1.validate)(contacts_schema_1.createContactGroupSchema), contacts_controller_1.contactsController.createGroup.bind(contacts_controller_1.contactsController));
router.get('/groups/:groupId', contacts_controller_1.contactsController.getGroupById.bind(contacts_controller_1.contactsController));
router.patch('/groups/:groupId', (0, validate_1.validate)(contacts_schema_1.updateContactGroupSchema), contacts_controller_1.contactsController.updateGroup.bind(contacts_controller_1.contactsController));
router.delete('/groups/:groupId', contacts_controller_1.contactsController.deleteGroup.bind(contacts_controller_1.contactsController));
router.get('/groups/:groupId/contacts', contacts_controller_1.contactsController.getGroupContacts.bind(contacts_controller_1.contactsController));
router.post('/groups/:groupId/contacts', (0, validate_1.validate)(contacts_schema_1.addContactsToGroupSchema), contacts_controller_1.contactsController.addContactsToGroup.bind(contacts_controller_1.contactsController));
router.delete('/groups/:groupId/contacts', (0, validate_1.validate)(contacts_schema_1.addContactsToGroupSchema), contacts_controller_1.contactsController.removeContactsFromGroup.bind(contacts_controller_1.contactsController));
// ============================================
// LIST / CREATE / IMPORT / BULK
// ============================================
router.get('/', contacts_controller_1.contactsController.getList.bind(contacts_controller_1.contactsController));
router.post('/', (0, validate_1.validate)(contacts_schema_1.createContactSchema), planLimits_1.requireActiveSubscription, planLimits_1.checkContactLimit, contacts_controller_1.contactsController.create.bind(contacts_controller_1.contactsController));
// Import contacts - with file upload
router.post('/import', planLimits_1.requireActiveSubscription, upload.single('file'), (req, res, next) => {
    contacts_controller_1.contactsController.import(req, res, next);
});
// ✅ Simple Bulk Paste (₹2,500+)
router.post('/bulk-paste', contacts_controller_1.contactsController.simpleBulkPaste.bind(contacts_controller_1.contactsController));
// ✅ CSV Upload (₹899+)
router.post('/csv-upload', contacts_controller_1.contactsController.csvUpload.bind(contacts_controller_1.contactsController));
router.patch('/bulk', (0, validate_1.validate)(contacts_schema_1.bulkUpdateSchema), contacts_controller_1.contactsController.bulkUpdate.bind(contacts_controller_1.contactsController));
router.delete('/bulk', (0, validate_1.validate)(contacts_schema_1.bulkDeleteSchema), contacts_controller_1.contactsController.bulkDelete.bind(contacts_controller_1.contactsController));
router.delete('/all', contacts_controller_1.contactsController.deleteAll.bind(contacts_controller_1.contactsController));
// ============================================
// CONTACT BY ID (LAST)
// ============================================
router.get('/:id', contacts_controller_1.contactsController.getById.bind(contacts_controller_1.contactsController));
router.patch('/:id', (0, validate_1.validate)(contacts_schema_1.updateContactSchema), contacts_controller_1.contactsController.update.bind(contacts_controller_1.contactsController));
router.delete('/:id', contacts_controller_1.contactsController.delete.bind(contacts_controller_1.contactsController));
exports.default = router;
//# sourceMappingURL=contacts.routes.js.map
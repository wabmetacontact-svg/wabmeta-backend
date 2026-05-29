import { Router } from 'express';
import { automationController } from './automation.controller';
import { authenticate } from '../../middleware/auth';
import { requireActiveSubscription, checkAutomationLimit } from '../../middleware/planLimits';

const router = Router();

// All routes require authentication
router.use(authenticate);

/**
 * @route   GET /api/v1/automations/stats
 * @desc    Get automation statistics
 */
router.get('/stats', automationController.getStats.bind(automationController));

/**
 * @route   GET /api/v1/automations
 * @desc    Get all automations
 */
router.get('/', automationController.getAll.bind(automationController));

/**
 * @route   POST /api/v1/automations
 * @desc    Create new automation
 */
router.post(
  '/',
  requireActiveSubscription,
  checkAutomationLimit,
  automationController.create.bind(automationController)
);

/**
 * @route   GET /api/v1/automations/:id
 * @desc    Get automation by ID
 */
router.get('/:id', automationController.getById.bind(automationController));

/**
 * @route   PUT /api/v1/automations/:id
 * @desc    Update automation
 */
router.put('/:id', automationController.update.bind(automationController));

/**
 * @route   DELETE /api/v1/automations/:id
 * @desc    Delete automation
 */
router.delete('/:id', automationController.delete.bind(automationController));

/**
 * @route   POST /api/v1/automations/:id/toggle
 * @desc    Toggle automation active status
 */
router.post('/:id/toggle', automationController.toggle.bind(automationController));

export default router;
// src/modules/users/users.routes.ts

import { Router } from 'express';
import { usersController } from './users.controller';
import { validate } from '../../middleware/validate';
import { authenticate } from '../../middleware/auth';
import {
  updateProfileSchema,
  updateAvatarSchema,
  deleteAccountSchema,
} from './users.schema';
import { rateLimit } from '../../middleware/rateLimit';

const router = Router();

// All routes require authentication
router.use(authenticate);

/**
 * @route   GET /api/v1/users/profile
 * @desc    Get current user profile
 * @access  Private
 */
router.get('/profile', usersController.getProfile.bind(usersController));

/**
 * @route   GET /api/v1/users/profile/full
 * @desc    Get profile with organizations
 * @access  Private
 */
router.get(
  '/profile/full',
  usersController.getProfileWithOrganizations.bind(usersController)
);

/**
 * @route   PUT /api/v1/users/profile
 * @desc    Update user profile
 * @access  Private
 */
router.put(
  '/profile',
  validate(updateProfileSchema),
  usersController.updateProfile.bind(usersController)
);

/**
 * @route   PUT /api/v1/users/avatar
 * @desc    Update user avatar
 * @access  Private
 */
router.put(
  '/avatar',
  validate(updateAvatarSchema),
  usersController.updateAvatar.bind(usersController)
);

/**
 * @route   GET /api/v1/users/stats
 * @desc    Get user statistics
 * @access  Private
 */
router.get('/stats', usersController.getStats.bind(usersController));

/**
 * @route   GET /api/v1/users/sessions
 * @desc    Get active sessions
 * @access  Private
 */
router.get('/sessions', usersController.getSessions.bind(usersController));

/**
 * @route   DELETE /api/v1/users/sessions/:sessionId
 * @desc    Revoke specific session
 * @access  Private
 */
router.delete(
  '/sessions/:sessionId',
  usersController.revokeSession.bind(usersController)
);

/**
 * @route   DELETE /api/v1/users/sessions
 * @desc    Revoke all sessions except current
 * @access  Private
 */
router.delete(
  '/sessions',
  usersController.revokeAllSessions.bind(usersController)
);

/**
 * @route   POST /api/v1/users/add-phone
 * @desc    Add phone number (for Google login users)
 * @access  Private
 */
router.post(
  '/add-phone',
  rateLimit({ windowMs: 60 * 1000, max: 3 }),
  usersController.addPhoneNumber.bind(usersController)
);

/**
 * @route   DELETE /api/v1/users/account
 * @desc    Delete user account
 * @access  Private
 */
router.delete(
  '/account',
  validate(deleteAccountSchema),
  usersController.deleteAccount.bind(usersController)
);
/**
 * @route   POST /api/v1/users/subscribe
 * @desc    Subscribe to push notifications
 * @access  Private
 */
router.post(
  '/subscribe',
  usersController.subscribePush.bind(usersController)
);

/**
 * @route   POST /api/v1/users/unsubscribe
 * @desc    Unsubscribe from push notifications
 * @access  Private
 */
router.post(
  '/unsubscribe',
  usersController.unsubscribePush.bind(usersController)
);

export default router;
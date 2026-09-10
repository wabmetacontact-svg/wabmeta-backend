import { Router } from "express";
import {
  getAccounts,
  disconnectAccount,
  connectAccount,
  getDmAutomations,
  createDmAutomation,
  toggleDmAutomation,
  deleteDmAutomation,
  getAnalytics,
  getInboxStats,
  getContent,
  getCommentRules,
  createCommentRule,
  toggleCommentRule,
  deleteCommentRule,
  getStoryRules,
  createStoryRule,
  toggleStoryRule,
  deleteStoryRule,
  sendMessage,
  sendMediaMessage,
  getMedia
} from "./instagram.controller";
import { checkConnectionLock } from '../../middleware/connectionLock';
import { authenticate } from '../../middleware/auth';
import { asyncHandler } from '../../middleware/errorHandler';

import { gateMutations, ADMIN_ROLES, OPERATOR_ROLES } from '../../middleware/requireRole';
const router = Router();

// Every Instagram route is tenant data. Without this the module was reachable
// without a token, and the controllers trusted an `x-organization-id` header.
router.use(authenticate);

// Agent inbox reply — operator-level (before the admin gate below). Sending a
// DM is a working-data action, not a channel-management one.
router.post('/send', gateMutations(...OPERATOR_ROLES), asyncHandler(sendMessage));
router.post('/send-media', gateMutations(...OPERATOR_ROLES), asyncHandler(sendMediaMessage));

// Inbound media proxy (GET, authenticated via ?token= so it works as an <img> src).
router.get('/media/:messageId', asyncHandler(getMedia));

// Remaining writes (connect, automations) are admin-only; reads stay open.
router.use(gateMutations(...ADMIN_ROLES));

// GET /api/instagram/accounts
router.get("/accounts", asyncHandler(getAccounts));

// DELETE /api/instagram/accounts/:id — clears the token and marks it inactive.
router.delete("/accounts/:id", asyncHandler(disconnectAccount));

// POST /api/instagram/connect
router.post("/connect", checkConnectionLock, asyncHandler(connectAccount));

// GET /api/instagram/automations
router.get("/automations", asyncHandler(getDmAutomations));

// POST /api/instagram/automations
router.post("/automations", asyncHandler(createDmAutomation));

// PATCH /api/instagram/automations/:id/toggle
router.patch("/automations/:id/toggle", asyncHandler(toggleDmAutomation));

// DELETE /api/instagram/automations/:id
router.delete("/automations/:id", asyncHandler(deleteDmAutomation));

// Story automation rules
router.get("/story-rules", asyncHandler(getStoryRules));
router.post("/story-rules", asyncHandler(createStoryRule));
router.patch("/story-rules/:id/toggle", asyncHandler(toggleStoryRule));
router.delete("/story-rules/:id", asyncHandler(deleteStoryRule));

// GET /api/instagram/analytics
router.get("/analytics", asyncHandler(getAnalytics));

// GET /api/instagram/inbox-stats (unified-inbox analytics for the dashboard)
router.get("/inbox-stats", asyncHandler(getInboxStats));

// GET /api/instagram/content (posts + active stories)
router.get("/content", asyncHandler(getContent));

// Comment automation rules
router.get("/comment-rules", asyncHandler(getCommentRules));
router.post("/comment-rules", asyncHandler(createCommentRule));
router.patch("/comment-rules/:id/toggle", asyncHandler(toggleCommentRule));
router.delete("/comment-rules/:id", asyncHandler(deleteCommentRule));

// GET /api/instagram/stats (Legacy/compatibility from previous phase)
router.get("/stats", asyncHandler(getAnalytics));

export default router;

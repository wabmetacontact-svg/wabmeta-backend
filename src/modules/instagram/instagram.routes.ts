import { Router } from "express";
import { 
  getAccounts,
  connectAccount,
  getDmAutomations,
  createDmAutomation,
  toggleDmAutomation,
  getAnalytics
} from "./instagram.controller";
import { checkConnectionLock } from '../../middleware/connectionLock';
import { authenticate } from '../../middleware/auth';

import { gateMutations, ADMIN_ROLES } from '../../middleware/requireRole';
const router = Router();

// Every Instagram route is tenant data. Without this the module was reachable
// without a token, and the controllers trusted an `x-organization-id` header.
router.use(authenticate);

// Writes are role-gated; reads stay open to every member including VIEWER.
router.use(gateMutations(...ADMIN_ROLES));

// GET /api/instagram/accounts
router.get("/accounts", getAccounts);

// POST /api/instagram/connect
router.post("/connect", checkConnectionLock, connectAccount);

// GET /api/instagram/automations
router.get("/automations", getDmAutomations);

// POST /api/instagram/automations
router.post("/automations", createDmAutomation);

// PATCH /api/instagram/automations/:id/toggle
router.patch("/automations/:id/toggle", toggleDmAutomation);

// GET /api/instagram/analytics
router.get("/analytics", getAnalytics);

// GET /api/instagram/stats (Legacy/compatibility from previous phase)
router.get("/stats", getAnalytics);

export default router;

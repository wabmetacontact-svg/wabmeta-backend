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

const router = Router();

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

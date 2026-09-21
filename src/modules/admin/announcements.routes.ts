// src/modules/admin/announcements.routes.ts
//
// The customer side of admin announcements: what the signed-in user's
// organization should see right now. Mounted at /api/announcements.

import { Router, Response, NextFunction } from 'express';
import { authenticate } from '../../middleware/auth';
import { AuthRequest } from '../../types/express';
import { activeAnnouncementsFor } from './admin.ops.service';

const router = Router();

router.get('/active', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const data = await activeAnnouncementsFor(req.user?.organizationId);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

export default router;

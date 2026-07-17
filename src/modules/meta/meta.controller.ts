// 📁 src/modules/meta/meta.controller.ts - COMPLETE FINAL VERSION

import { Request, Response, NextFunction } from 'express';
import { AppError } from '../../middleware/errorHandler';
import { sendSuccess } from '../../utils/response';
import prisma from '../../config/database';
import { MessageStatus } from '@prisma/client';
import crypto from 'crypto';
import axios from 'axios';
import { config } from '../../config';
import { templatesService } from '../templates/templates.service';
import { metaApi } from './meta.api';
import { encrypt } from '../../utils/encryption';
import { metaService } from './meta.service';

// Helper to safely get organization ID from headers
const getOrgId = (req: Request): string => {
  const header = req.headers['x-organization-id'];
  if (!header) return '';
  return Array.isArray(header) ? header[0] : header;
};

// Extended Request interface
interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
    organizationId?: string;
  };
}

export class MetaController {

  // ============================================
  // GET ACCOUNTS (OLD METHOD - WHATSAPPACCOUNT ONLY)
  // ============================================
  async getAccounts(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const organizationId = getOrgId(req) || req.query.organizationId as string;

      if (!organizationId) {
        throw new AppError('Organization ID is required', 400);
      }

      const orgIdString = Array.isArray(organizationId) ? organizationId[0] : organizationId;
      console.log('📋 Fetching accounts (old method) for org:', orgIdString);

      const accounts = await prisma.whatsAppAccount.findMany({
        where: { organizationId: orgIdString },
        orderBy: { createdAt: 'desc' },
      });

      console.log('   Found accounts:', accounts.length);

      return sendSuccess(res, accounts, 'Accounts fetched successfully');
    } catch (error) {
      next(error);
    }
  }

  // ============================================
  // GET SINGLE ACCOUNT
  // ============================================
  async getAccount(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const organizationId = getOrgId(req);

      if (!organizationId) {
        throw new AppError('Organization ID is required', 400);
      }

      const account = await prisma.whatsAppAccount.findFirst({
        where: { id, organizationId },
      });

      if (!account) {
        throw new AppError('Account not found', 404);
      }

      return sendSuccess(res, account, 'Account fetched successfully');
    } catch (error) {
      next(error);
    }
  }

  // ============================================
  // DISCONNECT ACCOUNT
  // ============================================
  async disconnectAccount(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const organizationId = getOrgId(req);

      if (!organizationId) {
        throw new AppError('Organization ID is required', 400);
      }

      const userId = req.user?.id;
      if (!userId) {
        throw new AppError('Authentication required', 401);
      }

      const membership = await prisma.organizationMember.findFirst({
        where: {
          organizationId,
          userId,
          role: { in: ['OWNER', 'ADMIN'] },
        },
      });

      if (!membership) {
        throw new AppError('You do not have permission to disconnect', 403);
      }

      const result = await metaService.disconnectAccount(id, organizationId);
      return sendSuccess(res, result, 'Account disconnected successfully');
    } catch (error) {
      next(error);
    }
  }

  // ============================================
  // GET EMBEDDED SIGNUP CONFIG
  // ============================================
  async getEmbeddedSignupConfig(req: Request, res: Response, next: NextFunction) {
    try {
      const config = {
        appId: process.env.META_APP_ID,
        configId: process.env.META_CONFIG_ID,
        version: 'v25.0',
        features: ['whatsapp_business_app_onboarding'],
      };

      return sendSuccess(res, config, 'Config fetched successfully');
    } catch (error) {
      next(error);
    }
  }

  // ============================================
  // GET INTEGRATION STATUS
  // ============================================
  async getIntegrationStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const status = {
        configured: !!(process.env.META_APP_ID && process.env.META_APP_SECRET),
        appId: process.env.META_APP_ID,
        version: 'v25.0',
        embeddedSignup: true,
      };

      return sendSuccess(res, status, 'Integration status fetched');
    } catch (error) {
      next(error);
    }
  }

}

export const metaController = new MetaController();
export default metaController;
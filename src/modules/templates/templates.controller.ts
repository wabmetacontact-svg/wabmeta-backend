import axios from 'axios';
import { Request, Response, NextFunction } from 'express';
import { templatesService } from './templates.service';
import { AppError } from '../../middleware/errorHandler';
import { TemplateStatus, TemplateCategory } from '@prisma/client';
import prisma from '../../config/database';
import { metaService } from '../meta/meta.service';
import { metaApi } from '../meta/meta.api';

interface AuthRequest extends Request {
  user?: { id: string; email: string; organizationId: string };
}

// ─── Helper: Get default WA account ──────────────────────────
const getDefaultAccountId = async (
  organizationId: string
): Promise<string | undefined> => {
  const account = await prisma.whatsAppAccount.findFirst({
    where: {
      organizationId,
      status: 'CONNECTED',
    },
    orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
    select: { id: true },
  });
  return account?.id;
};

// ─── Helper: Lazy load cloudinary ─────────────────────────────
const getCloudinary = () => {
  let cloudinaryService: any = null;
  try {
    cloudinaryService = require('../../services/cloudinary.service').cloudinaryService;
  } catch {
    throw new AppError('Media storage not configured. Contact support.', 500);
  }
  if (!cloudinaryService?.isConfigured()) {
    throw new AppError('Media storage not configured. Contact support.', 500);
  }
  return cloudinaryService;
};

class TemplatesController {

  // ── CREATE ──────────────────────────────────────────────────
  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const organizationId = (req as AuthRequest).user?.organizationId;
      if (!organizationId) throw new AppError('Organization context required', 400);

      const input = req.body;

      // Auto-detect account if not provided
      if (!input.whatsappAccountId) {
        input.whatsappAccountId = await getDefaultAccountId(organizationId);
      }

      const template = await templatesService.create(organizationId, input);

      return res.status(201).json({
        success: true,
        message: 'Template created successfully',
        data: template,
      });
    } catch (error) { next(error); }
  }

  // ── LIST ────────────────────────────────────────────────────
  async getList(req: Request, res: Response, next: NextFunction) {
    try {
      const organizationId = (req as AuthRequest).user?.organizationId;
      if (!organizationId) throw new AppError('Organization context required', 400);

      const page     = Math.max(1, parseInt(req.query.page as string) || 1);
      const limit    = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
      const search   = (req.query.search   as string)?.trim() || undefined;
      const status   = req.query.status   as TemplateStatus   | undefined;
      const category = req.query.category as TemplateCategory | undefined;
      const language = (req.query.language as string)?.trim() || undefined;
      const sortBy   = (req.query.sortBy   as string) || 'createdAt';
      const sortOrder= (req.query.sortOrder as 'asc' | 'desc') || 'desc';

      let whatsappAccountId = (req.query.whatsappAccountId as string)?.trim() || undefined;
      const wabaId          = (req.query.wabaId            as string)?.trim() || undefined;

      if (!whatsappAccountId && !wabaId) {
        whatsappAccountId = await getDefaultAccountId(organizationId);
      }

      const result = await templatesService.getList(organizationId, {
        page, limit, search, status, category, language,
        sortBy: sortBy as any, sortOrder,
        whatsappAccountId, wabaId,
      });

      return res.json({
        success: true,
        message: 'Templates fetched successfully',
        data: result.templates,
        meta: result.meta,
      });
    } catch (error) { next(error); }
  }

  // ── GET BY ID ───────────────────────────────────────────────
  async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const organizationId = (req as AuthRequest).user?.organizationId;
      if (!organizationId) throw new AppError('Organization context required', 400);

      const template = await templatesService.getById(
        organizationId,
        req.params.id as string
      );

      return res.json({
        success: true,
        message: 'Template fetched successfully',
        data: template,
      });
    } catch (error) { next(error); }
  }

  // ── UPDATE ──────────────────────────────────────────────────
  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const organizationId = (req as AuthRequest).user?.organizationId;
      if (!organizationId) throw new AppError('Organization context required', 400);

      const template = await templatesService.update(
        organizationId,
        req.params.id as string,
        req.body
      );

      return res.json({
        success: true,
        message: 'Template updated successfully',
        data: template,
      });
    } catch (error) { next(error); }
  }

  // ── DELETE ──────────────────────────────────────────────────
  async delete(req: Request, res: Response, next: NextFunction) {
    try {
      const organizationId = (req as AuthRequest).user?.organizationId;
      if (!organizationId) throw new AppError('Organization context required', 400);

      const result = await templatesService.delete(organizationId, req.params.id as string);

      return res.json({ success: true, message: result.message });
    } catch (error) { next(error); }
  }

  // ── DUPLICATE ───────────────────────────────────────────────
  async duplicate(req: Request, res: Response, next: NextFunction) {
    try {
      const organizationId = (req as AuthRequest).user?.organizationId;
      if (!organizationId) throw new AppError('Organization context required', 400);

      const { name, whatsappAccountId } = req.body;
      if (!name) throw new AppError('New template name is required', 400);

      const template = await templatesService.duplicate(
        organizationId, req.params.id as string, name, whatsappAccountId
      );

      return res.status(201).json({
        success: true,
        message: 'Template duplicated successfully',
        data: template,
      });
    } catch (error) { next(error); }
  }

  // ── STATS ───────────────────────────────────────────────────
  async getStats(req: Request, res: Response, next: NextFunction) {
    try {
      const organizationId = (req as AuthRequest).user?.organizationId;
      if (!organizationId) throw new AppError('Organization context required', 400);

      const whatsappAccountId =
        (req.query.whatsappAccountId as string)?.trim() || undefined;

      const stats = await templatesService.getStats(
        organizationId, whatsappAccountId
      );

      return res.json({ success: true, data: stats });
    } catch (error) { next(error); }
  }

  // ── PREVIEW ─────────────────────────────────────────────────
  async preview(req: Request, res: Response, next: NextFunction) {
    try {
      const {
        bodyText, variables, headerType,
        headerContent, footerText, buttons,
      } = req.body;

      if (!bodyText) throw new AppError('Body text is required', 400);

      const preview = await templatesService.preview(
        bodyText, variables || {}, headerType,
        headerContent, footerText, buttons
      );

      return res.json({ success: true, data: preview });
    } catch (error) { next(error); }
  }

  // ── APPROVED LIST ───────────────────────────────────────────
  async getApproved(req: Request, res: Response, next: NextFunction) {
    try {
      const organizationId = (req as AuthRequest).user?.organizationId;
      if (!organizationId) throw new AppError('Organization context required', 400);

      let whatsappAccountId =
        (req.query.whatsappAccountId as string)?.trim() || undefined;
      const wabaId =
        (req.query.wabaId as string)?.trim() || undefined;

      if (!whatsappAccountId && !wabaId) {
        whatsappAccountId = await getDefaultAccountId(organizationId);
      }

      if (!whatsappAccountId && !wabaId) {
        return res.json({
          success: true,
          message: 'No WhatsApp account connected',
          data: [],
        });
      }

      const templatesList = await templatesService.getApprovedTemplates(
        organizationId, whatsappAccountId, wabaId
      );

      return res.json({
        success: true,
        data: templatesList,
      });
    } catch (error) { next(error); }
  }

  // ── LANGUAGES ───────────────────────────────────────────────
  async getLanguages(req: Request, res: Response, next: NextFunction) {
    try {
      const organizationId = (req as AuthRequest).user?.organizationId;
      if (!organizationId) throw new AppError('Organization context required', 400);

      const whatsappAccountId =
        (req.query.whatsappAccountId as string)?.trim() || undefined;

      const langs = await templatesService.getLanguages(
        organizationId, whatsappAccountId
      );

      return res.json({ success: true, data: langs });
    } catch (error) { next(error); }
  }

  // ── SUBMIT TO META ──────────────────────────────────────────
  async submit(req: Request, res: Response, next: NextFunction) {
    try {
      const organizationId = (req as AuthRequest).user?.organizationId;
      if (!organizationId) throw new AppError('Organization context required', 400);

      const { whatsappAccountId, forceResubmit } = req.body || {};

      const result = await templatesService.submitToMeta(
        organizationId,
        req.params.id as string,
        whatsappAccountId
      );

      return res.json({ success: true, ...result });
    } catch (error) { next(error); }
  }

  // ── SYNC FROM META ──────────────────────────────────────────
  async sync(req: Request, res: Response, next: NextFunction) {
    try {
      const organizationId = (req as AuthRequest).user?.organizationId;
      if (!organizationId) throw new AppError('Organization context required', 400);

      let whatsappAccountId =
        req.body?.whatsappAccountId?.trim() || undefined;

      if (!whatsappAccountId) {
        whatsappAccountId = await getDefaultAccountId(organizationId);
      }

      if (!whatsappAccountId) {
        return res.status(400).json({
          success: false,
          message: 'No WhatsApp account connected. Please connect first.',
        });
      }

      const result = await templatesService.syncFromMeta(
        organizationId, whatsappAccountId
      );

      return res.json({ success: true, ...result });
    } catch (error) { next(error); }
  }

  // ── CHECK CONNECTION ────────────────────────────────────────
  async checkConnection(req: Request, res: Response, next: NextFunction) {
    try {
      const organizationId = (req as AuthRequest).user?.organizationId;
      if (!organizationId) throw new AppError('Organization context required', 400);

      const accounts = await prisma.whatsAppAccount.findMany({
        where: { organizationId },
        select: {
          id: true, phoneNumber: true, displayName: true,
          status: true, isDefault: true, wabaId: true,
          createdAt: true, tokenExpiresAt: true,
        },
        orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
      });

      if (accounts.length === 0) {
        return res.json({
          success: false,
          message: 'No WhatsApp accounts found',
          hasConnection: false,
          accounts: [],
          connectedCount: 0,
          totalCount: 0,
        });
      }

      const accountsWithStatus = await Promise.all(
        accounts.map(async (account) => {
          let tokenValid = false;
          const isExpired = account.tokenExpiresAt
            ? account.tokenExpiresAt < new Date()
            : false;

          try {
            const result = await metaService.getAccountWithToken(account.id);
            tokenValid = !!result?.accessToken;
          } catch { /* silent */ }

          return {
            ...account,
            tokenValid,
            isExpired,
            isReady:
              account.status === 'CONNECTED' && tokenValid && !isExpired,
          };
        })
      );

      const connected = accountsWithStatus.filter(a => a.isReady);
      const defaultAcc = accountsWithStatus.find(a => a.isDefault);

      return res.json({
        success: true,
        hasConnection: connected.length > 0,
        defaultAccount: defaultAcc || connected[0] || null,
        accounts: accountsWithStatus,
        connectedCount: connected.length,
        totalCount: accounts.length,
      });
    } catch (error) { next(error); }
  }

  // ── UPLOAD TO META (Re-upload helper) ───────────────────────
  // Sirf tab use hota hai jab:
  // - Cloudinary URL hai
  // - Fresh handle chahiye (resubmit ke liye)
  async uploadToMeta(req: Request, res: Response, next: NextFunction) {
    try {
      const organizationId = (req as AuthRequest).user?.organizationId;
      if (!organizationId) throw new AppError('Organization context required', 400);

      const { cloudinaryUrl, mimeType, filename, whatsappAccountId } = req.body;
      if (!cloudinaryUrl) throw new AppError('cloudinaryUrl is required', 400);
      if (!cloudinaryUrl.startsWith('http')) {
        throw new AppError('Invalid cloudinaryUrl', 400);
      }

      // Get account
      let account = null;
      if (whatsappAccountId) {
        account = await prisma.whatsAppAccount.findFirst({
          where: { id: whatsappAccountId, organizationId },
        });
      }
      if (!account) {
        account = await prisma.whatsAppAccount.findFirst({
          where: { organizationId, status: 'CONNECTED' },
          orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
        });
      }
      if (!account) {
        throw new AppError('No connected WhatsApp account found', 400);
      }

      const accountWithToken = await metaService.getAccountWithToken(account.id);
      if (!accountWithToken?.accessToken) {
        throw new AppError('Failed to decrypt WhatsApp token', 500);
      }

      // Download from Cloudinary
      const response = await axios.get(cloudinaryUrl, {
        responseType: 'arraybuffer',
        timeout: 60_000,
        headers: { 'User-Agent': 'WabMeta/1.0', Accept: '*/*' },
      });

      const buffer      = Buffer.from(response.data);
      const contentType = (response.headers['content-type'] || '')
        .split(';')[0].trim();
      const finalMime   = (contentType && contentType !== 'application/octet-stream')
        ? contentType
        : (mimeType || 'image/jpeg');
      const finalName   = filename ||
        cloudinaryUrl.split('/').pop()?.split('?')[0] || 'media';

      // Upload to Meta
      const result = await metaApi.uploadMedia(
        account.phoneNumberId,
        accountWithToken.accessToken,
        buffer,
        finalMime,
        finalName,
        account.wabaId
      );

      return res.json({
        success: true,
        mediaId: result.id,
        cloudinaryUrl,
      });
    } catch (error: any) {
      console.error('❌ uploadToMeta failed:', error.message);
      next(error);
    }
  }

  // ── REUPLOAD MEDIA ──────────────────────────────────────────
  // Existing template ka Cloudinary URL use karke
  // fresh handle banao aur DB update karo
  async reuploadMedia(req: Request, res: Response, next: NextFunction) {
    try {
      const organizationId = (req as AuthRequest).user?.organizationId;
      if (!organizationId) throw new AppError('Organization context required', 400);

      const template = await prisma.template.findFirst({
        where: { id: req.params.id as string, organizationId },
      });

      if (!template) throw new AppError('Template not found', 404);

      const mediaTypes = ['IMAGE', 'VIDEO', 'DOCUMENT'];
      if (!mediaTypes.includes(
        String(template.headerType || '').toUpperCase()
      )) {
        throw new AppError('Template has no media header', 400);
      }

      const cloudinaryUrl = template.headerContent;
      if (!cloudinaryUrl?.startsWith('http')) {
        throw new AppError(
          'No valid Cloudinary URL found in this template. ' +
          'Please use fix-media to upload a new file.',
          400
        );
      }

      // Get WA account
      const account = await prisma.whatsAppAccount.findFirst({
        where: { organizationId, status: 'CONNECTED' },
        orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
      });
      if (!account) throw new AppError('No connected WhatsApp account', 400);

      const accountWithToken = await metaService.getAccountWithToken(account.id);
      if (!accountWithToken?.accessToken) {
        throw new AppError('Failed to decrypt token', 500);
      }

      // Download from Cloudinary
      console.log('📥 Downloading from Cloudinary:', cloudinaryUrl);
      const response = await axios.get(cloudinaryUrl, {
        responseType: 'arraybuffer',
        timeout: 60_000,
        headers: { 'User-Agent': 'WabMeta/1.0' },
      });

      const buffer = Buffer.from(response.data);
      const mime   = (response.headers['content-type'] || 'image/jpeg')
        .split(';')[0].trim();
      const fname  = cloudinaryUrl.split('/').pop()?.split('?')[0] || 'media';

      // Upload to Meta
      const result = await metaApi.uploadMedia(
        account.phoneNumberId,
        accountWithToken.accessToken,
        buffer,
        mime,
        fname,
        account.wabaId
      );

      console.log('✅ Reupload success, numeric ID:', result.id);

      // Update DB - sirf timestamp update karo
      // headerContent (Cloudinary URL) same rahega
      // headerMediaId DB mein store nahi karte
      await prisma.template.update({
        where: { id: template.id },
        data: {
          headerMediaUploadedAt:   new Date(),
          headerMediaLastVerified: new Date(),
        } as any,
      });

      return res.json({
        success: true,
        message: 'Media re-uploaded successfully. Now submit template for approval.',
        data: {
          metaMediaId:   result.id,
          cloudinaryUrl: cloudinaryUrl,
        },
      });
    } catch (error: any) {
      console.error('❌ Reupload failed:', error.message);
      next(error);
    }
  }

  // ── FIX MEDIA ───────────────────────────────────────────────
  // Jab Cloudinary URL bhi nahi hai - fresh file upload karo
  async fixMedia(req: any, res: Response, next: NextFunction) {
    try {
      const organizationId = (req as AuthRequest).user?.organizationId;
      if (!organizationId) throw new AppError('Organization context required', 400);

      const file = req.file;
      if (!file) throw new AppError('No file uploaded', 400);

      const template = await prisma.template.findFirst({
        where: { id: req.params.id as string, organizationId },
      });
      if (!template) throw new AppError('Template not found', 404);

      const mediaTypes = ['IMAGE', 'VIDEO', 'DOCUMENT'];
      if (!mediaTypes.includes(
        String(template.headerType || '').toUpperCase()
      )) {
        throw new AppError('Template has no media header', 400);
      }

      // Get WA account
      const account = await prisma.whatsAppAccount.findFirst({
        where: { organizationId, status: 'CONNECTED' },
        orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
      });
      if (!account) throw new AppError('No connected WhatsApp account', 400);

      const accountWithToken = await metaService.getAccountWithToken(account.id);
      if (!accountWithToken?.accessToken) {
        throw new AppError('Failed to decrypt token', 500);
      }

      // 1. Upload to Cloudinary (permanent backup)
      let newCloudinaryUrl = template.headerContent || '';
      try {
        const cloudinary = getCloudinary();
        const result = await cloudinary.uploadTemplateMedia(
          file.buffer, file.originalname, file.mimetype, organizationId
        );
        newCloudinaryUrl = result.secureUrl;
        console.log('✅ Fix-media: Cloudinary done');
      } catch (err: any) {
        console.warn('⚠️ Fix-media: Cloudinary failed:', err.message);
        // Continue - Meta upload is critical
      }

      // 2. Upload to Meta (get numeric ID for verification)
      const metaResult = await metaApi.uploadMedia(
        account.phoneNumberId,
        accountWithToken.accessToken,
        file.buffer,
        file.mimetype,
        file.originalname,
        account.wabaId
      );

      console.log('✅ Fix-media: Meta done, ID:', metaResult.id);

      // 3. Update DB
      const updateData: any = {
        headerMediaUploadedAt:   new Date(),
        headerMediaLastVerified: new Date(),
      };
      // Only update cloudinaryUrl if we got a new one
      if (newCloudinaryUrl?.startsWith('http')) {
        updateData.headerContent = newCloudinaryUrl;
      }

      await prisma.template.update({
        where: { id: template.id },
        data: updateData,
      });

      return res.json({
        success: true,
        message: 'Media fixed. Template is ready for campaigns.',
        data: {
          templateId:    template.id,
          metaMediaId:   metaResult.id,
          cloudinaryUrl: newCloudinaryUrl || null,
          headerType:    template.headerType,
        },
      });
    } catch (error: any) {
      console.error('❌ Fix-media failed:', error.message);
      next(error instanceof AppError ? error : new AppError(error.message, 500));
    }
  }

  // ── UPLOAD MEDIA ─────────────────────────────────────────────
  // ✅ Controller mein sirf delegate karo - sab logic media.ts mein hai
  async uploadMedia(req: any, res: Response, next: NextFunction) {
    // templates.media.ts ka uploadTemplateMedia call hota hai route se directly
    // Ye method sirf fallback ke liye hai agar route directly call kare
    return next(new AppError('Use /upload-media route directly', 500));
  }
}

export const templatesController = new TemplatesController();
export default templatesController;
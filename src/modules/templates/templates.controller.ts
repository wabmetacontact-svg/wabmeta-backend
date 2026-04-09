import axios from 'axios';
import { Request, Response, NextFunction } from 'express';
import { templatesService } from './templates.service';
import { AppError } from '../../middleware/errorHandler';
import { TemplateStatus, TemplateCategory } from '@prisma/client';
import prisma from '../../config/database';
import { metaService } from '../meta/meta.service';
import { metaApi } from '../meta/meta.api';
import { safeDecryptStrict } from '../../utils/encryption';

// Extended Request interface
interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
    organizationId: string;
  };
}

class TemplatesController {

  // ==========================================
  // HELPER: Get default WhatsApp account
  // ==========================================
  private async getDefaultAccountId(organizationId: string): Promise<string | undefined> {
    // First try default account
    let account = await prisma.whatsAppAccount.findFirst({
      where: {
        organizationId,
        status: 'CONNECTED',
        isDefault: true,
      },
      select: { id: true },
    });

    // If no default, get any connected account
    if (!account) {
      account = await prisma.whatsAppAccount.findFirst({
        where: {
          organizationId,
          status: 'CONNECTED',
        },
        orderBy: { createdAt: 'desc' },
        select: { id: true },
      });
    }

    return account?.id;
  }

  // ✅ NEW HELPER: Get wabaId for an account
  private async getWabaIdForAccount(accountId: string): Promise<string | undefined> {
    const account = await prisma.whatsAppAccount.findUnique({
      where: { id: accountId },
      select: { wabaId: true },
    });
    return account?.wabaId || undefined;
  }

  // ==========================================
  // CREATE TEMPLATE
  // ==========================================
  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const organizationId = (req as AuthRequest).user?.organizationId;
      if (!organizationId) {
        throw new AppError('Organization context required', 400);
      }

      const input = req.body;

      console.log('📝 Creating template:', {
        organizationId,
        name: input.name,
        language: input.language,
        whatsappAccountId: input.whatsappAccountId,
        headerMediaId: input.headerMediaId,
      });

      // If no whatsappAccountId provided, use default
      if (!input.whatsappAccountId) {
        input.whatsappAccountId = await this.getDefaultAccountId(organizationId);
      }

      const template = await templatesService.create(organizationId, input);

      return res.status(201).json({
        success: true,
        message: 'Template created successfully',
        data: template,
      });
    } catch (error) {
      next(error);
    }
  }

  // ==========================================
  // GET TEMPLATES LIST
  // ✅ FIX: Added wabaId query param support
  // ==========================================
  async getList(req: Request, res: Response, next: NextFunction) {
    try {
      const organizationId = (req as AuthRequest).user?.organizationId;
      if (!organizationId) {
        throw new AppError('Organization context required', 400);
      }

      // Parse query params safely
      const page = req.query.page ? parseInt(req.query.page as string) : 1;
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 20;
      const search = (req.query.search as string)?.trim() || undefined;
      const status = req.query.status as TemplateStatus | undefined;
      const category = req.query.category as TemplateCategory | undefined;
      const language = (req.query.language as string)?.trim() || undefined;
      const sortBy = (req.query.sortBy as string) || 'createdAt';
      const sortOrder = (req.query.sortOrder as 'asc' | 'desc') || 'desc';
      const whatsappAccountId = (req.query.whatsappAccountId as string)?.trim() || undefined;
      const wabaId = (req.query.wabaId as string)?.trim() || undefined;  // ✅ NEW

      console.log('📋 Fetching templates:', {
        organizationId,
        page,
        limit,
        search,
        status,
        whatsappAccountId,
        wabaId,  // ✅ log it
      });

      const result = await templatesService.getList(organizationId, {
        page,
        limit,
        search,
        status,
        category,
        language,
        sortBy: sortBy as any,
        sortOrder,
        whatsappAccountId,
        wabaId,  // ✅ pass to service
      });

      return res.json({
        success: true,
        message: 'Templates fetched successfully',
        data: result.templates,
        meta: result.meta,
      });
    } catch (error) {
      next(error);
    }
  }

  // ==========================================
  // GET TEMPLATE BY ID
  // ==========================================
  async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const organizationId = (req as AuthRequest).user?.organizationId;
      if (!organizationId) {
        throw new AppError('Organization context required', 400);
      }

      const id = req.params.id as string;
      if (!id) {
        throw new AppError('Template ID is required', 400);
      }

      const template = await templatesService.getById(organizationId, id);

      return res.json({
        success: true,
        message: 'Template fetched successfully',
        data: template,
      });
    } catch (error) {
      next(error);
    }
  }

  // ==========================================
  // UPDATE TEMPLATE
  // ==========================================
  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const organizationId = (req as AuthRequest).user?.organizationId;
      if (!organizationId) {
        throw new AppError('Organization context required', 400);
      }

      const id = req.params.id as string;
      if (!id) {
        throw new AppError('Template ID is required', 400);
      }

      const input = req.body;
      const template = await templatesService.update(organizationId, id, input);

      return res.json({
        success: true,
        message: 'Template updated successfully',
        data: template,
      });
    } catch (error) {
      next(error);
    }
  }

  // ==========================================
  // DELETE TEMPLATE
  // ==========================================
  async delete(req: Request, res: Response, next: NextFunction) {
    try {
      const organizationId = (req as AuthRequest).user?.organizationId;
      if (!organizationId) {
        throw new AppError('Organization context required', 400);
      }

      const id = req.params.id as string;
      if (!id) {
        throw new AppError('Template ID is required', 400);
      }

      const result = await templatesService.delete(organizationId, id);

      return res.json({
        success: true,
        message: result.message,
      });
    } catch (error) {
      next(error);
    }
  }

  // ==========================================
  // DUPLICATE TEMPLATE
  // ==========================================
  async duplicate(req: Request, res: Response, next: NextFunction) {
    try {
      const organizationId = (req as AuthRequest).user?.organizationId;
      if (!organizationId) {
        throw new AppError('Organization context required', 400);
      }

      const id = req.params.id as string;
      if (!id) {
        throw new AppError('Template ID is required', 400);
      }

      const { name, whatsappAccountId } = req.body;
      if (!name) {
        throw new AppError('New template name is required', 400);
      }

      const template = await templatesService.duplicate(
        organizationId,
        id,
        name,
        whatsappAccountId
      );

      return res.status(201).json({
        success: true,
        message: 'Template duplicated successfully',
        data: template,
      });
    } catch (error) {
      next(error);
    }
  }

  // ==========================================
  // GET TEMPLATE STATS
  // ==========================================
  async getStats(req: Request, res: Response, next: NextFunction) {
    try {
      const organizationId = (req as AuthRequest).user?.organizationId;
      if (!organizationId) {
        throw new AppError('Organization context required', 400);
      }

      const whatsappAccountId = (req.query.whatsappAccountId as string)?.trim() || undefined;

      const stats = await templatesService.getStats(organizationId, whatsappAccountId);

      return res.json({
        success: true,
        message: 'Stats fetched successfully',
        data: stats,
      });
    } catch (error) {
      next(error);
    }
  }

  // ==========================================
  // PREVIEW TEMPLATE
  // ==========================================
  async preview(req: Request, res: Response, next: NextFunction) {
    try {
      const { bodyText, variables, headerType, headerContent, footerText, buttons } = req.body;

      if (!bodyText) {
        throw new AppError('Body text is required', 400);
      }

      const preview = await templatesService.preview(
        bodyText,
        variables || {},
        headerType,
        headerContent,
        footerText,
        buttons
      );

      return res.json({
        success: true,
        message: 'Preview generated successfully',
        data: preview,
      });
    } catch (error) {
      next(error);
    }
  }

  // ==========================================
  // GET APPROVED TEMPLATES
  // ✅ FIX: Added wabaId support
  // ==========================================
  async getApproved(req: Request, res: Response, next: NextFunction) {
    try {
      const organizationId = (req as AuthRequest).user?.organizationId;
      if (!organizationId) {
        throw new AppError('Organization context required', 400);
      }

      let whatsappAccountId = (req.query.whatsappAccountId as string)?.trim() || undefined;
      let wabaId = (req.query.wabaId as string)?.trim() || undefined;  // ✅ NEW

      // If no account specified, use default
      if (!whatsappAccountId && !wabaId) {
        whatsappAccountId = await this.getDefaultAccountId(organizationId);
      }

      // ✅ If whatsappAccountId provided but no wabaId, resolve wabaId
      if (whatsappAccountId && !wabaId) {
        wabaId = await this.getWabaIdForAccount(whatsappAccountId);
      }

      // If still no account, return empty array
      if (!whatsappAccountId && !wabaId) {
        return res.json({
          success: true,
          message: 'No WhatsApp account connected',
          data: [],
        });
      }

      const templates = await templatesService.getApprovedTemplates(
        organizationId,
        whatsappAccountId,
        wabaId  // ✅ pass wabaId
      );

      return res.json({
        success: true,
        message: 'Approved templates fetched successfully',
        data: templates,
      });
    } catch (error) {
      next(error);
    }
  }

  // ==========================================
  // GET LANGUAGES
  // ==========================================
  async getLanguages(req: Request, res: Response, next: NextFunction) {
    try {
      const organizationId = (req as AuthRequest).user?.organizationId;
      if (!organizationId) {
        throw new AppError('Organization context required', 400);
      }

      const whatsappAccountId = (req.query.whatsappAccountId as string)?.trim() || undefined;

      const languages = await templatesService.getLanguages(organizationId, whatsappAccountId);

      return res.json({
        success: true,
        message: 'Languages fetched successfully',
        data: languages,
      });
    } catch (error) {
      next(error);
    }
  }

  // ==========================================
  // SUBMIT TO META
  // ==========================================
  async submit(req: Request, res: Response, next: NextFunction) {
    try {
      const organizationId = (req as AuthRequest).user?.organizationId;
      if (!organizationId) {
        throw new AppError('Organization context required', 400);
      }

      const id = req.params.id as string;
      if (!id) {
        throw new AppError('Template ID is required', 400);
      }

      const { whatsappAccountId } = req.body;

      const result = await templatesService.submitToMeta(organizationId, id, whatsappAccountId);

      return res.json({
        success: true,
        message: result.message,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  // ==========================================
  // SYNC FROM META
  // ==========================================
  async sync(req: Request, res: Response, next: NextFunction) {
    try {
      const organizationId = (req as AuthRequest).user?.organizationId;
      if (!organizationId) {
        throw new AppError('Organization context required', 400);
      }

      let whatsappAccountId = req.body?.whatsappAccountId?.trim() || undefined;

      // If no account specified, use default
      if (!whatsappAccountId) {
        whatsappAccountId = await this.getDefaultAccountId(organizationId);
      }

      // If still no account, return error
      if (!whatsappAccountId) {
        return res.status(400).json({
          success: false,
          message: 'No WhatsApp account connected. Please connect a WhatsApp account first.',
        });
      }

      console.log('🔄 Syncing templates for account:', whatsappAccountId);

      const result = await templatesService.syncFromMeta(organizationId, whatsappAccountId);

      return res.json({
        success: true,
        message: result.message,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  // ==========================================
  // CHECK WHATSAPP CONNECTION
  // ==========================================
  async checkConnection(req: Request, res: Response, next: NextFunction) {
    try {
      const organizationId = (req as AuthRequest).user?.organizationId;
      if (!organizationId) {
        throw new AppError('Organization context required', 400);
      }

      // Check for any WhatsApp accounts
      const accounts = await prisma.whatsAppAccount.findMany({
        where: { organizationId },
        select: {
          id: true,
          phoneNumber: true,
          displayName: true,
          status: true,
          isDefault: true,
          wabaId: true,
          createdAt: true,
          tokenExpiresAt: true,
        },
        orderBy: [
          { isDefault: 'desc' },
          { createdAt: 'desc' },
        ],
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

      // Check which accounts are truly connected
      const accountsWithStatus = await Promise.all(
        accounts.map(async (account) => {
          let canDecrypt = false;
          let isExpired = false;

          try {
            const result = await metaService.getAccountWithToken(account.id);
            canDecrypt = !!result;
          } catch (err) {
            // Silent fail
          }

          if (account.tokenExpiresAt) {
            isExpired = account.tokenExpiresAt < new Date();
          }

          return {
            ...account,
            canDecrypt,
            isExpired,
            isReady: account.status === 'CONNECTED' && canDecrypt && !isExpired,
          };
        })
      );

      const connectedAccounts = accountsWithStatus.filter(a => a.isReady);
      const defaultAccount = accountsWithStatus.find(a => a.isDefault);

      return res.json({
        success: true,
        hasConnection: connectedAccounts.length > 0,
        defaultAccount: defaultAccount || connectedAccounts[0] || null,
        accounts: accountsWithStatus,
        connectedCount: connectedAccounts.length,
        totalCount: accounts.length,
      });
    } catch (error: any) {
      console.error('❌ Error checking connection:', error.message);
      next(error);
    }
  }

  // ==========================================
  // UPLOAD TO META (Helper for Frontend)
  // ==========================================
  async uploadToMeta(req: Request, res: Response, next: NextFunction) {
    try {
      const organizationId = (req as AuthRequest).user?.organizationId;
      if (!organizationId) {
        throw new AppError('Organization context required', 400);
      }

      const { cloudinaryUrl, mimeType, filename, whatsappAccountId } = req.body;

      if (!cloudinaryUrl) {
        throw new AppError('cloudinaryUrl is required', 400);
      }

      console.log('📤 Backend helper: Uploading to Meta from', cloudinaryUrl);

      // 1. Get WhatsApp account
      let waAccount = null;
      if (whatsappAccountId) {
        waAccount = await prisma.whatsAppAccount.findFirst({
          where: { id: whatsappAccountId, organizationId }
        });
      }

      if (!waAccount) {
        waAccount = await prisma.whatsAppAccount.findFirst({
          where: { organizationId, status: 'CONNECTED' },
          orderBy: { isDefault: 'desc' }
        });
      }

      if (!waAccount) {
        // Try MetaConnection (new structure)
        const metaConn = await (prisma as any).metaConnection.findUnique({
          where: { organizationId },
          include: { phoneNumbers: { where: { isActive: true }, take: 1 } }
        });

        if (metaConn && metaConn.phoneNumbers?.length > 0) {
          const phone = metaConn.phoneNumbers[0];
          const token = safeDecryptStrict(metaConn.accessToken);
          
          if (!token) throw new AppError('Failed to decrypt MetaConnection token', 500);

          // Download from URL
          const response = await axios.get(cloudinaryUrl, {
            responseType: 'arraybuffer',
            timeout: 30000
          });

          const buffer = Buffer.from(response.data);
          
          // Upload to Meta
          const result = await metaApi.uploadMedia(
            phone.phoneNumberId,
            token,
            buffer,
            mimeType || response.headers['content-type'] || 'image/jpeg',
            filename || cloudinaryUrl.split('/').pop() || 'media',
            metaConn.wabaId
          );

          return res.json({
            success: true,
            mediaId: result.id,
            cloudinaryUrl
          });
        }

        throw new AppError('No connected WhatsApp account found', 400);
      }

      // 2. Decrypt token
      const accountWithToken = await metaService.getAccountWithToken(waAccount.id);
      if (!accountWithToken) {
        throw new AppError('Failed to decrypt WhatsApp token', 500);
      }

      // 3. Download from Cloudinary
      const response = await axios.get(cloudinaryUrl, {
        responseType: 'arraybuffer',
        timeout: 30000
      });

      const buffer = Buffer.from(response.data);

      // 4. Upload to Meta
      const metaUpload = await metaApi.uploadMedia(
        waAccount.phoneNumberId,
        accountWithToken.accessToken,
        buffer,
        mimeType || response.headers['content-type'] || 'image/jpeg',
        filename || cloudinaryUrl.split('/').pop() || 'media',
        waAccount.wabaId
      );

      return res.json({
        success: true,
        mediaId: metaUpload.id,
        cloudinaryUrl
      });

    } catch (error: any) {
      console.error('❌ Upload to Meta endpoint failed:', error.message);
      next(error);
    }
  }

  // ==========================================
  // RE-UPLOAD MEDIA (Fix for old templates)
  // ==========================================
  async reuploadMedia(req: Request, res: Response, next: NextFunction) {
    try {
      const organizationId = (req as AuthRequest).user?.organizationId;
      if (!organizationId) {
        throw new AppError('Organization context required', 400);
      }

      const id = req.params.id as string;
      if (!id) {
        throw new AppError('Template ID is required', 400);
      }

      const template = await prisma.template.findFirst({
        where: { id, organizationId }
      });

      if (!template) {
        throw new AppError('Template not found', 404);
      }

      if (!['IMAGE', 'VIDEO', 'DOCUMENT'].includes(template.headerType?.toUpperCase() || '')) {
        throw new AppError('Template has no media header', 400);
      }

      const cloudinaryUrl = template.headerContent;
      if (!cloudinaryUrl?.startsWith('http')) {
        throw new AppError('Invalid or missing media URL in template content', 400);
      }

      // 1. Get WhatsApp account
      const waAccount = await prisma.whatsAppAccount.findFirst({
        where: { 
          organizationId,
          status: 'CONNECTED'
        },
        orderBy: { isDefault: 'desc' }
      });

      if (!waAccount) {
        throw new AppError('No connected WhatsApp account found', 400);
      }

      // 2. Decrypt token
      const accountWithToken = await metaService.getAccountWithToken(waAccount.id);
      if (!accountWithToken) {
        throw new AppError('Failed to decrypt WhatsApp token', 500);
      }

      // 3. Download from Cloudinary
      console.log('📥 Re-upload Fix: Downloading from Cloudinary:', cloudinaryUrl);
      
      const response = await axios.get(cloudinaryUrl, {
        responseType: 'arraybuffer',
        timeout: 30000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; WabMeta/1.0)'
        }
      });

      const buffer = Buffer.from(response.data);
      const mimeType = response.headers['content-type'] || 'image/jpeg';
      const filename = cloudinaryUrl.split('/').pop()?.split('?')[0] || 'media';

      console.log('📤 Re-upload Fix: Uploading to Meta:', { size: buffer.length, mimeType });

      // 4. Upload to Meta
      const result = await metaApi.uploadMedia(
        waAccount.phoneNumberId,
        accountWithToken.accessToken,
        buffer,
        mimeType,
        filename,
        waAccount.wabaId
      );

      console.log('✅ Re-upload Fix successful, Meta Media ID:', result.id);

      // 5. Update template in database
      await prisma.template.update({
        where: { id },
        data: { headerMediaId: result.id }
      });

      return res.json({
        success: true,
        message: 'Media re-uploaded to Meta successfully',
        metaMediaId: result.id,
        cloudinaryUrl
      });

    } catch (error: any) {
      console.error('❌ Re-upload failed:', error.message);
      next(error);
    }
  }

  // ==========================================
  // FIX MEDIA — Direct file upload to fix broken templates
  // Works even when headerContent (Cloudinary URL) is null/missing
  // POST /:id/fix-media (multipart/form-data with 'file' field)
  // ==========================================
  async fixMedia(req: any, res: Response, next: NextFunction) {

    try {
      const organizationId = (req as AuthRequest).user?.organizationId;
      if (!organizationId) throw new AppError('Organization context required', 400);

      const id = req.params.id as string;
      if (!id) throw new AppError('Template ID is required', 400);

      const file = req.file;
      if (!file) throw new AppError('No file uploaded. Send file in "file" field (multipart/form-data)', 400);

      // 1. Find template
      const template = await prisma.template.findFirst({ where: { id, organizationId } });
      if (!template) throw new AppError('Template not found', 404);

      if (!['IMAGE', 'VIDEO', 'DOCUMENT'].includes(template.headerType?.toUpperCase() || '')) {
        throw new AppError('Template does not have a media header', 400);
      }

      console.log('🔧 Fix-media: Starting for template:', template.name, {
        mimetype: file.mimetype,
        size: file.size,
        currentHeaderContent: template.headerContent ? template.headerContent.substring(0, 40) : 'NULL',
        currentHeaderMediaId: template.headerMediaId ? template.headerMediaId.substring(0, 30) : 'NULL',
      });

      // 2. Get WhatsApp account
      let waAccount = await prisma.whatsAppAccount.findFirst({
        where: { organizationId, status: 'CONNECTED' },
        orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
      });

      if (!waAccount) throw new AppError('No connected WhatsApp account found', 400);

      const accountWithToken = await metaService.getAccountWithToken(waAccount.id);
      if (!accountWithToken?.accessToken) throw new AppError('Failed to decrypt WhatsApp token', 500);

      let cloudinaryUrl = template.headerContent || '';
      let metaNumericId = '';

      // 3. Upload to Cloudinary (permanent URL)
      let cloudinaryService: any = null;
      try {
        const mod = require('../../services/cloudinary.service');
        cloudinaryService = mod.cloudinaryService;
      } catch (e) {}

      if (cloudinaryService?.isConfigured()) {
        try {
          console.log('☁️ Fix-media: Uploading to Cloudinary...');
          const result = await cloudinaryService.uploadTemplateMedia(
            file.buffer,
            file.originalname,
            file.mimetype,
            organizationId
          );
          cloudinaryUrl = result.secureUrl;
          console.log('✅ Fix-media: Cloudinary success:', cloudinaryUrl.substring(0, 60));
        } catch (cloudErr: any) {
          console.warn('⚠️ Fix-media: Cloudinary failed:', cloudErr.message);
        }
      }

      // 4. Upload to Meta (get numeric media ID)
      try {
        console.log('☁️ Fix-media: Uploading to Meta...');
        const result = await metaApi.uploadMedia(
          waAccount.phoneNumberId,
          accountWithToken.accessToken,
          file.buffer,
          file.mimetype,
          file.originalname,
          waAccount.wabaId
        );
        metaNumericId = result.id;
        console.log('✅ Fix-media: Meta upload success, numeric ID:', metaNumericId);
      } catch (metaErr: any) {
        console.error('❌ Fix-media: Meta upload failed:', metaErr.message);
        throw new AppError(`Failed to upload to Meta: ${metaErr.message}`, 500);
      }

      // 5. Save both to DB
      const updateData: any = {
        headerMediaId: metaNumericId,
      };
      if (cloudinaryUrl) {
        updateData.headerContent = cloudinaryUrl;
      }

      await prisma.template.update({
        where: { id },
        data: updateData,
      });

      console.log('✅ Fix-media: Template updated:', { id, metaNumericId, cloudinaryUrl: cloudinaryUrl ? 'set' : 'unchanged' });

      return res.json({
        success: true,
        message: 'Media fixed successfully. Template can now be used in campaigns.',
        data: {
          templateId: id,
          metaMediaId: metaNumericId,
          cloudinaryUrl: cloudinaryUrl || null,
          headerType: template.headerType,
        },
      });

    } catch (error: any) {
      console.error('❌ Fix-media failed:', error.message);
      next(error instanceof AppError ? error : new AppError(error.message, 500));
    }
  }
}

export const templatesController = new TemplatesController();
export default templatesController;
import axios from 'axios';
import { Response, NextFunction } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { AppError } from '../../middleware/errorHandler';
import { metaUploadService } from '../../services/meta.upload.service';
import { metaService } from '../meta/meta.service';
import prisma from '../../config/database';

// Try Cloudinary if available
let cloudinaryService: any = null;
try {
  const mod = require('../../services/cloudinary.service');
  cloudinaryService = mod.cloudinaryService;
} catch (e) {
  console.warn('⚠️ Cloudinary not available');
}

const storage = multer.memoryStorage();

const fileFilter = (req: any, file: any, cb: any) => {
  const allowedMimes = [
    'image/jpeg', 'image/png', 'image/jpg',
    'video/mp4', 'video/3gpp',
    'application/pdf',
  ];

  if (allowedMimes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new AppError(`Invalid file type: ${file.mimetype}. Allowed: JPEG, PNG, MP4, 3GPP, PDF`, 400), false);
  }
};

// ✅ Max 50MB to allow large videos (per-type checks done after upload)
export const uploadMiddleware = multer({
  storage,
  fileFilter,
  limits: { fileSize: 50 * 1024 * 1024 },
});

// ✅ Per-type size limits
const FILE_SIZE_LIMITS: Record<string, { max: number; label: string }> = {
  'image/jpeg': { max: 50 * 1024 * 1024, label: '50MB' },
  'image/png':  { max: 50 * 1024 * 1024, label: '50MB' },
  'image/jpg':  { max: 50 * 1024 * 1024, label: '50MB' },
  'video/mp4':  { max: 50 * 1024 * 1024, label: '50MB' },
  'video/3gpp': { max: 50 * 1024 * 1024, label: '50MB' },
  'application/pdf': { max: 50 * 1024 * 1024, label: '50MB' },
};

export const uploadTemplateMedia = async (
  req: any,
  res: Response,
  next: NextFunction
) => {
  try {
    const file = req.file;
    const organizationId = req.user?.organizationId;
    const { whatsappAccountId } = req.body;

    if (!file) throw new AppError('No file uploaded', 400);
    if (!organizationId) throw new AppError('Organization required', 400);

    // ✅ Per-type size validation
    const sizeLimit = FILE_SIZE_LIMITS[file.mimetype];
    if (sizeLimit && file.size > sizeLimit.max) {
      const fileSizeMB = (file.size / (1024 * 1024)).toFixed(1);
      throw new AppError(
        `File too large (${fileSizeMB}MB). Maximum allowed for ${file.mimetype.split('/')[0]}: ${sizeLimit.label}`,
        400
      );
    }

    console.log('📤 Upload request:', {
      filename: file.originalname,
      size: `${(file.size / 1024).toFixed(2)} KB`,
      mime: file.mimetype,
    });

    // Get WhatsApp account
    let account = null;

    if (whatsappAccountId) {
      account = await prisma.whatsAppAccount.findFirst({
        where: { id: whatsappAccountId, organizationId, status: 'CONNECTED' },
      });
    }

    if (!account) {
      account = await prisma.whatsAppAccount.findFirst({
        where: { organizationId, status: 'CONNECTED' },
        orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
      });
    }

    if (!account) {
      throw new AppError('No connected WhatsApp account', 400);
    }

    // Get token
    const accountWithToken = await metaService.getAccountWithToken(account.id);
    if (!accountWithToken?.accessToken) {
      throw new AppError('Failed to get credentials', 500);
    }

    let mediaHandle = '';
    let cloudinaryUrl = '';
    let localUrl = '';

    // ✅ Step 1: ALWAYS upload to Cloudinary in parallel (gives permanent public URL for campaign sends)
    // Meta upload handles (4:...) expire in minutes — Cloudinary URLs are permanent
    if (cloudinaryService?.isConfigured()) {
      try {
        console.log('☁️ Uploading to Cloudinary (permanent URL for campaigns)...');
        const result = await cloudinaryService.uploadTemplateMedia(
          file.buffer,
          file.originalname,
          file.mimetype,
          organizationId
        );
        cloudinaryUrl = result.secureUrl;
        localUrl = cloudinaryUrl;
        console.log('✅ Cloudinary upload success! URL:', cloudinaryUrl.substring(0, 60));
      } catch (cloudErr: any) {
        console.warn('⚠️ Cloudinary upload failed (will use local file):', cloudErr.message);
      }
    }

    // ✅ Step 2: Also save to local disk as fallback (in case Cloudinary fails)
    if (!localUrl) {
      try {
        const templatesUploadDir = path.join(process.cwd(), 'uploads', 'templates');
        if (!fs.existsSync(templatesUploadDir)) {
          fs.mkdirSync(templatesUploadDir, { recursive: true });
        }
        const safeFilename = `${Date.now()}_${file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
        const localFilePath = path.join(templatesUploadDir, safeFilename);
        fs.writeFileSync(localFilePath, file.buffer);
        const backendUrl = process.env.BACKEND_URL || process.env.APP_URL || '';
        if (backendUrl) {
          localUrl = `${backendUrl}/uploads/templates/${safeFilename}`;
          console.log('💾 Fallback local file URL:', localUrl);
        }
      } catch (diskErr: any) {
        console.warn('⚠️ Disk save failed:', diskErr.message);
      }
    }

    // ✅ Step 3: Upload to Meta (for template creation approval — handle is temporary)
    try {
      console.log('☁️ Uploading to Meta (for template approval)...');
      const result = await metaUploadService.uploadMediaForTemplate(
        'app',
        accountWithToken.accessToken,
        file.buffer,
        file.mimetype,
        file.originalname
      );
      mediaHandle = result.handle;
      console.log('✅ Meta resumable upload success!');
    } catch (resumableError: any) {
      console.warn('⚠️ Meta resumable upload failed:', resumableError.message);
      
      // Fallback: Simple Upload 
      try {
        console.log('☁️ Falling back to Meta Simple Upload...');
        const result = await metaUploadService.uploadMediaSimple(
          account.phoneNumberId,
          accountWithToken.accessToken,
          file.buffer,
          file.mimetype,
          file.originalname
        );
        mediaHandle = result.id;
        console.log('✅ Meta simple upload success!');
      } catch (simpleError: any) {
        console.warn('⚠️ Meta simple upload also failed:', simpleError.message);
        // If both Meta uploads fail but we have Cloudinary URL, use it as handle too
        if (localUrl) {
          mediaHandle = localUrl;
          console.log('⚠️ Using Cloudinary URL as Meta handle fallback');
        } else {
          throw new AppError('All upload methods failed. Please try again later.', 500);
        }
      }
    }

    console.log('✅ Upload complete:', {
      metaHandle: mediaHandle.substring(0, 40) + '...',
      cloudinaryUrl: cloudinaryUrl ? cloudinaryUrl.substring(0, 60) : 'none',
      localUrl: localUrl ? localUrl.substring(0, 60) : 'none',
      hasPermUrl: !!localUrl,
    });

    return res.json({
      success: true,
      message: 'Media uploaded successfully',
      data: {
        // Sneak the permanent URL through the frontend back to us using a delimited string
        mediaId: `${mediaHandle}:::${cloudinaryUrl || localUrl || ''}`,
        handle: `${mediaHandle}:::${cloudinaryUrl || localUrl || ''}`,
        url: cloudinaryUrl || localUrl || '',
        localUrl: localUrl,
        filename: file.originalname,
        mimeType: file.mimetype,
        size: file.size,
        wabaId: account.wabaId,
      },
    });
  } catch (error: any) {
    console.error('❌ Upload failed:', error.message);
    next(error instanceof AppError ? error : new AppError(error.message, 500));
  }
};

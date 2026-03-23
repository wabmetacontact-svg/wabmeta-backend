// src/modules/templates/templates.media.ts

import { Response, NextFunction } from 'express';
import multer from 'multer';
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

    // ✅ Method 1: Try Resumable Upload (app-level)
    try {
      console.log('☁️ Trying Resumable Upload API...');
      
      const result = await metaUploadService.uploadMediaForTemplate(
        'app',  // Use 'app' endpoint
        accountWithToken.accessToken,
        file.buffer,
        file.mimetype,
        file.originalname
      );
      
      mediaHandle = result.handle;
      console.log('✅ Resumable upload success!');
    } catch (resumableError: any) {
      console.warn('⚠️ Resumable upload failed:', resumableError.message);
      
      // ✅ Method 2: Try Simple Upload (phone number)
      try {
        console.log('☁️ Falling back to Simple Upload...');
        
        const result = await metaUploadService.uploadMediaSimple(
          account.phoneNumberId,
          accountWithToken.accessToken,
          file.buffer,
          file.mimetype,
          file.originalname
        );
        
        mediaHandle = result.id;
        console.log('✅ Simple upload success!');
      } catch (simpleError: any) {
        console.warn('⚠️ Simple upload failed:', simpleError.message);
        
        // ✅ Method 3: Fallback to Cloudinary
        if (cloudinaryService?.isConfigured()) {
          console.log('☁️ Falling back to Cloudinary...');
          
          const result = await cloudinaryService.uploadTemplateMedia(
            file.buffer,
            file.originalname,
            file.mimetype,
            organizationId
          );
          
          mediaHandle = result.secureUrl;
          cloudinaryUrl = result.secureUrl;
          console.log('✅ Cloudinary upload success!');
        } else {
          throw new AppError(
            'All upload methods failed. Please try again later.',
            500
          );
        }
      }
    }

    console.log('✅ Final media handle:', {
      handle: mediaHandle.substring(0, 60) + '...',
      isUrl: mediaHandle.startsWith('http'),
      source: cloudinaryUrl ? 'cloudinary' : 'meta',
    });

    return res.json({
      success: true,
      message: 'Media uploaded successfully',
      data: {
        mediaId: mediaHandle,
        handle: mediaHandle,  // ✅ Added handle
        url: cloudinaryUrl || '',
        filename: file.originalname,
        mimeType: file.mimetype,
        size: file.size,
        wabaId: account.wabaId, // ✅ Added wabaId
      },
    });
  } catch (error: any) {
    console.error('❌ All upload methods failed:', error.message);
    next(error instanceof AppError ? error : new AppError(error.message, 500));
  }
};

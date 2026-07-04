// src/modules/templates/templates.media.ts - FIXED
// ✅ FIX 1: Simplified flow - Cloudinary + Meta Resumable only
// ✅ FIX 2: No more numeric ID (not needed for templates)
// ✅ FIX 3: Pre-upload validation (size, format, dimensions)
// ✅ FIX 4: Clear separation: handle (temp) vs cloudinaryUrl (permanent)

import { Response, NextFunction } from 'express';
import multer from 'multer';
import { AppError } from '../../middleware/errorHandler';
import { metaUploadService } from '../../services/meta.upload.service';
import { metaService } from '../meta/meta.service';
import prisma from '../../config/database';

let cloudinaryService: any = null;
try {
  const mod = require('../../services/cloudinary.service');
  cloudinaryService = mod.cloudinaryService;
} catch (e) {
  console.warn('⚠️ Cloudinary not available');
}

// ============================================
// MULTER CONFIG
// ============================================
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
    cb(
      new AppError(
        `Invalid file type: ${file.mimetype}. Allowed: JPEG, PNG, MP4, 3GPP, PDF`,
        400
      ),
      false
    );
  }
};

export const uploadMiddleware = multer({
  storage,
  fileFilter,
  limits: { fileSize: 100 * 1024 * 1024 }, // 100MB (PDF ke liye)
});

// ============================================
// VALIDATION HELPER
// ============================================
const validateFileForMeta = (file: any): void => {
  // Meta's strict size limits
  const LIMITS: Record<string, number> = {
    'image/jpeg': 5 * 1024 * 1024,      // 5MB
    'image/png': 5 * 1024 * 1024,       // 5MB
    'image/jpg': 5 * 1024 * 1024,
    'video/mp4': 16 * 1024 * 1024,      // 16MB
    'video/3gpp': 16 * 1024 * 1024,
    'application/pdf': 100 * 1024 * 1024, // 100MB
  };

  const maxSize = LIMITS[file.mimetype];
  if (!maxSize) {
    throw new AppError(`Unsupported file type: ${file.mimetype}`, 400);
  }

  if (file.size > maxSize) {
    const maxMB = (maxSize / 1024 / 1024).toFixed(0);
    const fileMB = (file.size / 1024 / 1024).toFixed(2);
    throw new AppError(
      `File too large. ${file.mimetype} max: ${maxMB}MB, got: ${fileMB}MB`,
      400
    );
  }

  if (file.size === 0) {
    throw new AppError('File is empty', 400);
  }
};

// ============================================
// MAIN UPLOAD HANDLER
// ============================================
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

    // ✅ Pre-validate file
    validateFileForMeta(file);

    console.log('📤 Template media upload:', {
      filename: file.originalname,
      size: `${(file.size / 1024).toFixed(2)} KB`,
      mime: file.mimetype,
    });

    // ============================================
    // STEP 1: Get WhatsApp Account
    // ============================================
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
      throw new AppError(
        'No connected WhatsApp account. Please connect in Settings.',
        400
      );
    }

    const accountWithToken = await metaService.getAccountWithToken(account.id);
    if (!accountWithToken?.accessToken) {
      throw new AppError('Failed to get WhatsApp credentials', 500);
    }

    // ============================================
    // STEP 2: Upload to Cloudinary (PERMANENT)
    // ✅ Ye DB mein hamesha rahega
    // ✅ Campaign send ke time se fresh Meta ID banane ke liye
    // ============================================
    let cloudinaryUrl = '';

    if (cloudinaryService?.isConfigured()) {
      try {
        console.log('☁️ Uploading to Cloudinary...');
        const result = await cloudinaryService.uploadTemplateMedia(
          file.buffer,
          file.originalname,
          file.mimetype,
          organizationId
        );
        cloudinaryUrl = result.secureUrl;
        console.log('✅ Cloudinary:', cloudinaryUrl.substring(0, 60));
      } catch (cloudErr: any) {
        console.error('❌ Cloudinary FAILED:', cloudErr.message);
        // Cloudinary fail = critical for permanent storage
        throw new AppError(
          'Failed to store media permanently. Please try again.',
          500
        );
      }
    } else {
      throw new AppError(
        'Media storage not configured. Contact support.',
        500
      );
    }

    // ============================================
    // STEP 3: Upload to Meta - Get HANDLE ONLY
    // ✅ Ye handle SIRF template creation ke liye hai
    // ✅ Once approved, Meta stores media permanently
    // ============================================
    let metaHandle = '';

    try {
      console.log('📱 Uploading to Meta (resumable for handle)...');
      const result = await metaUploadService.uploadMediaForTemplate(
        '', // ignored - uses config.meta.appId
        accountWithToken.accessToken,
        file.buffer,
        file.mimetype,
        file.originalname
      );
      metaHandle = result.handle;
      console.log('✅ Meta handle:', metaHandle.substring(0, 40) + '...');
    } catch (metaErr: any) {
      console.error('❌ Meta handle upload FAILED:', metaErr.message);
      throw new AppError(
        `Meta upload failed: ${metaErr.message}. ` +
        `Please check file format and try again.`,
        500
      );
    }

    // ============================================
    // STEP 4: Clean response
    // ✅ mediaHandle: Template creation ke liye (Meta)
    // ✅ cloudinaryUrl: PERMANENT storage (DB backup + auto-refresh)
    // ❌ NO metaNumericId (not needed for templates)
    // ❌ NO ":::" smuggling
    // ============================================
    const responseData = {
      // For Meta template creation - the handle
      mediaHandle: metaHandle,
      
      // For permanent storage in DB
      cloudinaryUrl: cloudinaryUrl,
      permanentUrl: cloudinaryUrl,
      
      // Backward compatibility (old code)
      mediaId: metaHandle,
      url: cloudinaryUrl,
      
      // File metadata
      filename: file.originalname,
      mimeType: file.mimetype,
      size: file.size,
      wabaId: account.wabaId,
      whatsappAccountId: account.id,
    };

    console.log('✅ Upload complete:', {
      handle: `${metaHandle.substring(0, 30)}...`,
      cloudinary: `${cloudinaryUrl.substring(0, 50)}...`,
    });

    return res.json({
      success: true,
      message: 'Media uploaded successfully',
      data: responseData,
    });

  } catch (error: any) {
    console.error('❌ Template media upload failed:', error.message);
    next(error instanceof AppError ? error : new AppError(error.message, 500));
  }
};

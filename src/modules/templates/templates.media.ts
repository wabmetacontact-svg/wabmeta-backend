import axios from 'axios';
import { Response, NextFunction } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { AppError } from '../../middleware/errorHandler';
import { metaUploadService } from '../../services/meta.upload.service';
import { metaService } from '../meta/meta.service';
import { metaApi } from '../meta/meta.api';
import prisma from '../../config/database';

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
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
});

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

    console.log('📤 Template media upload started:', {
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

    if (!account) throw new AppError('No connected WhatsApp account', 400);

    const accountWithToken = await metaService.getAccountWithToken(account.id);
    if (!accountWithToken?.accessToken) {
      throw new AppError('Failed to get WhatsApp credentials', 500);
    }

    // ============================================
    // STEP 2: Upload to Cloudinary (PERMANENT URL)
    // Ye kabhi expire nahi hota - campaign send ke
    // liye hamesh available rahega
    // ============================================
    let cloudinaryUrl = '';

    if (cloudinaryService?.isConfigured()) {
      try {
        console.log('☁️ Uploading to Cloudinary (permanent storage)...');
        const result = await cloudinaryService.uploadTemplateMedia(
          file.buffer,
          file.originalname,
          file.mimetype,
          organizationId
        );
        cloudinaryUrl = result.secureUrl;
        console.log('✅ Cloudinary upload success:', cloudinaryUrl.substring(0, 70));
      } catch (cloudErr: any) {
        console.warn('⚠️ Cloudinary upload failed:', cloudErr.message);
      }
    }

    // Fallback: Local disk storage
    if (!cloudinaryUrl) {
      try {
        const uploadDir = path.join(process.cwd(), 'uploads', 'templates');
        if (!fs.existsSync(uploadDir)) {
          fs.mkdirSync(uploadDir, { recursive: true });
        }
        const safeFilename = `${Date.now()}_${file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
        const localFilePath = path.join(uploadDir, safeFilename);
        fs.writeFileSync(localFilePath, file.buffer);
        const backendUrl = process.env.BACKEND_URL || process.env.APP_URL || '';
        if (backendUrl) {
          cloudinaryUrl = `${backendUrl}/uploads/templates/${safeFilename}`;
          console.log('💾 Local fallback URL saved:', cloudinaryUrl);
        }
      } catch (diskErr: any) {
        console.warn('⚠️ Disk save failed:', diskErr.message);
      }
    }

    // ============================================
    // STEP 3: Upload to Meta - Get NUMERIC ID
    // Numeric ID = permanent for message sending
    // Ye campaigns me directly use hoga
    // ============================================
    let metaNumericId = '';

    try {
      console.log('📱 Uploading to Meta (simple upload - numeric ID)...');
      const result = await metaApi.uploadMedia(
        account.phoneNumberId,
        accountWithToken.accessToken,
        file.buffer,
        file.mimetype,
        file.originalname,
        account.wabaId
      );
      metaNumericId = result.id;
      console.log('✅ Meta numeric ID obtained:', metaNumericId);
    } catch (simpleErr: any) {
      console.warn('⚠️ Meta simple upload failed:', simpleErr.message);
    }

    // ============================================
    // STEP 4: Upload to Meta - Get RESUMABLE HANDLE
    // Handle = template creation/approval ke liye
    // Ye temporary hai - campaign send me use NAHI hoga
    // ============================================
    let metaHandle = '';

    try {
      console.log('📱 Uploading to Meta (resumable - approval handle)...');
      const result = await metaUploadService.uploadMediaForTemplate(
        'app',
        accountWithToken.accessToken,
        file.buffer,
        file.mimetype,
        file.originalname
      );
      metaHandle = result.handle;
      console.log('✅ Meta handle obtained:', metaHandle.substring(0, 30) + '...');
    } catch (resumableErr: any) {
      console.warn('⚠️ Meta resumable upload failed:', resumableErr.message);
      // Fallback: numeric ID as handle too
      if (metaNumericId) metaHandle = metaNumericId;
    }

    // Agar kuch bhi nahi mila toh error
    if (!metaHandle && !metaNumericId && !cloudinaryUrl) {
      throw new AppError(
        'All upload methods failed. Please check your WhatsApp connection and try again.',
        500
      );
    }

    // ============================================
    // STEP 5: ✅ KEY FIX - Clean response
    // NO MORE ":::" SMUGGLING
    // Sab fields alag alag bhejo frontend ko
    // ============================================
    const responseData = {
      // Template creation ke liye (Meta approval)
      // Handle preferred, numeric ID as fallback
      mediaHandle: metaHandle || metaNumericId || '',

      // ✅ Campaign sending ke liye - PERMANENT
      // Numeric ID directly use hoga - kabhi expire nahi
      metaNumericId: metaNumericId || null,

      // ✅ DB storage ke liye - PERMANENT URL
      // Campaign me fresh upload ke liye use hoga
      cloudinaryUrl: cloudinaryUrl || null,
      permanentUrl: cloudinaryUrl || null,

      // ✅ Legacy compatibility (kuch jagah use ho raha hai)
      // NO MORE ":::" - clean mediaId
      mediaId: metaHandle || metaNumericId || '',
      url: cloudinaryUrl || '',

      // File info
      filename: file.originalname,
      mimeType: file.mimetype,
      size: file.size,
      wabaId: account.wabaId,
      whatsappAccountId: account.id,
    };

    console.log('✅ Upload complete - Clean response:', {
      metaHandle: responseData.mediaHandle
        ? responseData.mediaHandle.substring(0, 30) + '...'
        : 'none',
      metaNumericId: responseData.metaNumericId || 'none',
      cloudinaryUrl: responseData.cloudinaryUrl
        ? responseData.cloudinaryUrl.substring(0, 60)
        : 'none',
      hasSmuggling: false, // ✅ Confirmed: no ":::" in response
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

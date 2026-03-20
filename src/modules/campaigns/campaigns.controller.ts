// 📁 src/modules/campaigns/campaigns.controller.ts - COMPLETE FINAL VERSION

import { Request, Response, NextFunction } from 'express';
import multer from 'multer';
import { campaignsService } from './campaigns.service';
import { campaignUploadService } from './campaigns.upload.service';
import { sendSuccess } from '../../utils/response';
import { AppError } from '../../middleware/errorHandler';
import {
  CreateCampaignInput,
  UpdateCampaignInput,
  CampaignsQueryInput,
  CampaignContactsQueryInput,
} from './campaigns.types';

// ==========================================
// EXTENDED REQUEST INTERFACE
// ==========================================
interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
    organizationId?: string;
  };
  file?: any;
}

// ==========================================
// MULTER CONFIGURATION FOR CSV UPLOAD
// ==========================================
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB max file size
  },
  fileFilter: (req: Request, file: any, cb: any) => {
    const isCSV =
      file.mimetype === 'text/csv' ||
      file.mimetype === 'application/vnd.ms-excel' ||
      file.originalname.endsWith('.csv');

    if (isCSV) {
      cb(null, true);
    } else {
      cb(new Error('Only CSV files are allowed'));
    }
  },
});

export const csvUpload = upload.single('file');

// ==========================================
// CAMPAIGNS CONTROLLER CLASS
// ==========================================
export class CampaignsController {
  // ==========================================
  // CREATE CAMPAIGN
  // ==========================================
  async create(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const organizationId = req.user!.organizationId;
      if (!organizationId) {
        throw new AppError('Organization context required', 400);
      }

      const input: CreateCampaignInput = req.body;

      console.log('📦 Creating campaign:', {
        organizationId,
        userId: req.user!.id,
        name: input.name,
      });

      const campaign = await campaignsService.create(organizationId, req.user!.id, input);

      return sendSuccess(res, campaign, 'Campaign created successfully', 201);
    } catch (error) {
      next(error);
    }
  }

  // ==========================================
  // GET CAMPAIGNS LIST
  // ==========================================
  async getList(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const organizationId = req.user!.organizationId;
      if (!organizationId) {
        throw new AppError('Organization context required', 400);
      }

      const query: CampaignsQueryInput = {
        page: parseInt(req.query.page as string) || 1,
        limit: parseInt(req.query.limit as string) || 20,
        search: req.query.search ? String(req.query.search) : undefined,
        status: req.query.status as any,
        sortBy: (req.query.sortBy as any) || 'createdAt',
        sortOrder: (req.query.sortOrder as any) || 'desc',
      };

      const result = await campaignsService.getList(organizationId, query);

      return res.json({
        success: true,
        message: 'Campaigns fetched successfully',
        data: result.campaigns,
        meta: result.meta,
      });
    } catch (error) {
      next(error);
    }
  }

  // ==========================================
  // GET CAMPAIGN BY ID
  // ==========================================
  async getById(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const organizationId = req.user!.organizationId;
      if (!organizationId) {
        throw new AppError('Organization context required', 400);
      }

      const id = String(req.params.id);
      if (!id) {
        throw new AppError('Campaign ID is required', 400);
      }

      const campaign = await campaignsService.getById(organizationId, id);

      return sendSuccess(res, campaign, 'Campaign fetched successfully');
    } catch (error) {
      next(error);
    }
  }

  // ==========================================
  // UPDATE CAMPAIGN
  // ==========================================
  async update(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const organizationId = req.user!.organizationId;
      if (!organizationId) {
        throw new AppError('Organization context required', 400);
      }

      const id = String(req.params.id);
      if (!id) {
        throw new AppError('Campaign ID is required', 400);
      }

      const input: UpdateCampaignInput = req.body;

      console.log('📝 Updating campaign:', { id, organizationId });

      const campaign = await campaignsService.update(organizationId, id, input);

      return sendSuccess(res, campaign, 'Campaign updated successfully');
    } catch (error) {
      next(error);
    }
  }

  // ==========================================
  // DELETE CAMPAIGN
  // ==========================================
  async delete(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const organizationId = req.user!.organizationId;
      if (!organizationId) {
        throw new AppError('Organization context required', 400);
      }

      const id = String(req.params.id);
      if (!id) {
        throw new AppError('Campaign ID is required', 400);
      }

      console.log('🗑️ Deleting campaign:', { id, organizationId });

      const result = await campaignsService.delete(organizationId, id);

      return sendSuccess(res, result, result.message);
    } catch (error) {
      next(error);
    }
  }

  // ==========================================
  // START CAMPAIGN
  // ==========================================
  async start(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const organizationId = req.user!.organizationId;
      if (!organizationId) {
        throw new AppError('Organization context required', 400);
      }

      const id = String(req.params.id);
      if (!id) {
        throw new AppError('Campaign ID is required', 400);
      }

      console.log('🚀 Starting campaign:', { id, organizationId });

      const campaign = await campaignsService.start(organizationId, id);

      return sendSuccess(res, campaign, 'Campaign started successfully');
    } catch (error) {
      next(error);
    }
  }

  // ==========================================
  // PAUSE CAMPAIGN
  // ==========================================
  async pause(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const organizationId = req.user!.organizationId;
      if (!organizationId) {
        throw new AppError('Organization context required', 400);
      }

      const id = String(req.params.id);
      if (!id) {
        throw new AppError('Campaign ID is required', 400);
      }

      console.log('⏸️ Pausing campaign:', { id, organizationId });

      const campaign = await campaignsService.pause(organizationId, id);

      return sendSuccess(res, campaign, 'Campaign paused successfully');
    } catch (error) {
      next(error);
    }
  }

  // ==========================================
  // RESUME CAMPAIGN
  // ==========================================
  async resume(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const organizationId = req.user!.organizationId;
      if (!organizationId) {
        throw new AppError('Organization context required', 400);
      }

      const id = String(req.params.id);
      if (!id) {
        throw new AppError('Campaign ID is required', 400);
      }

      console.log('▶️ Resuming campaign:', { id, organizationId });

      const campaign = await campaignsService.resume(organizationId, id);

      return sendSuccess(res, campaign, 'Campaign resumed successfully');
    } catch (error) {
      next(error);
    }
  }

  // ==========================================
  // CANCEL CAMPAIGN
  // ==========================================
  async cancel(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const organizationId = req.user!.organizationId;
      if (!organizationId) {
        throw new AppError('Organization context required', 400);
      }

      const id = String(req.params.id);
      if (!id) {
        throw new AppError('Campaign ID is required', 400);
      }

      console.log('❌ Cancelling campaign:', { id, organizationId });

      const campaign = await campaignsService.cancel(organizationId, id);

      return sendSuccess(res, campaign, 'Campaign cancelled successfully');
    } catch (error) {
      next(error);
    }
  }

  // ==========================================
  // GET CAMPAIGN CONTACTS
  // ==========================================
  async getContacts(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const organizationId = req.user!.organizationId;
      if (!organizationId) throw new AppError('Organization required', 400);

      const campaignId = req.params.campaignId || req.params.id;
      const { page, limit, status, search } = req.query;

      const result = await campaignsService.getCampaignContacts(
        organizationId,
        String(campaignId),
        {
          page: Number(page) || 1,
          limit: Number(limit) || 50,
          status: status as string,
          search: search as string,
        }
      );

      return sendSuccess(res, result, 'Campaign contacts fetched');
    } catch (error) {
      next(error);
    }
  }

  // ==========================================
  // RETRY FAILED MESSAGES
  // ==========================================
  async retry(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const organizationId = req.user!.organizationId;
      if (!organizationId) {
        throw new AppError('Organization context required', 400);
      }

      const id = String(req.params.id);
      if (!id) {
        throw new AppError('Campaign ID is required', 400);
      }

      const { retryFailed = true, retryPending = false } = req.body;

      console.log('🔄 Retrying campaign messages:', {
        id,
        organizationId,
        retryFailed,
        retryPending,
      });

      const result = await campaignsService.retry(
        organizationId,
        id,
        retryFailed,
        retryPending
      );

      return sendSuccess(res, result, result.message);
    } catch (error) {
      next(error);
    }
  }

  // ==========================================
  // DUPLICATE CAMPAIGN
  // ==========================================
  async duplicate(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const organizationId = req.user!.organizationId;
      if (!organizationId) {
        throw new AppError('Organization context required', 400);
      }

      const id = String(req.params.id);
      if (!id) {
        throw new AppError('Campaign ID is required', 400);
      }

      const { name } = req.body;
      if (!name || typeof name !== 'string' || name.trim().length === 0) {
        throw new AppError('Campaign name is required', 400);
      }

      console.log('📋 Duplicating campaign:', { id, newName: name });

      const campaign = await campaignsService.duplicate(organizationId, id, name.trim());

      return sendSuccess(res, campaign, 'Campaign duplicated successfully', 201);
    } catch (error) {
      next(error);
    }
  }

  // ==========================================
  // GET CAMPAIGN STATS
  // ==========================================
  async getStats(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const organizationId = req.user!.organizationId;
      if (!organizationId) {
        throw new AppError('Organization context required', 400);
      }

      const stats = await campaignsService.getStats(organizationId);

      return sendSuccess(res, stats, 'Stats fetched successfully');
    } catch (error) {
      next(error);
    }
  }

  // ==========================================
  // GET CAMPAIGN ANALYTICS
  // ==========================================
  async getAnalytics(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const organizationId = req.user!.organizationId;
      if (!organizationId) {
        throw new AppError('Organization context required', 400);
      }

      const id = String(req.params.id);
      if (!id) {
        throw new AppError('Campaign ID is required', 400);
      }

      const analytics = await campaignsService.getAnalytics(organizationId, id);

      return sendSuccess(res, analytics, 'Analytics fetched successfully');
    } catch (error) {
      next(error);
    }
  }

  // ==========================================
  // ✅ NEW: UPLOAD CSV CONTACTS
  // ==========================================
  async uploadContacts(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.id;
      const organizationId = req.user!.organizationId;

      if (!organizationId) {
        throw new AppError('Organization context required', 400);
      }

      if (!req.file) {
        throw new AppError('CSV file is required', 400);
      }

      console.log('📤 Processing CSV upload:', {
        userId,
        organizationId,
        filename: req.file.originalname,
        size: req.file.size,
      });

      const result = await campaignUploadService.processCsvFile(
        req.file.buffer,
        userId,
        organizationId
      );

      console.log('✅ CSV processed successfully:', {
        total: result.totalRows,
        successful: result.validRows,
        failed: result.invalidRows,
      });

      return sendSuccess(res, result, 'CSV processed successfully');
    } catch (error: any) {
      console.error('❌ CSV upload error:', error);

      // Handle multer errors
      if (error.message === 'Only CSV files are allowed') {
        return next(new AppError('Only CSV files are allowed', 400));
      }

      if (error.code === 'LIMIT_FILE_SIZE') {
        return next(new AppError('File size exceeds 5MB limit', 400));
      }

      next(error);
    }
  }

  // ==========================================
  // ✅ NEW: GET CSV UPLOAD TEMPLATE
  // ==========================================
  async getUploadTemplate(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const template = campaignUploadService.getTemplateHeaders();

      return sendSuccess(
        res,
        {
          headers: template,
          example: {
            phone: '+911234567890',
            firstName: 'John',
            lastName: 'Doe',
            email: 'john@example.com',
            tags: 'customer,premium',
          },
          instructions: [
            'Phone number is required',
            'Use international format with country code (e.g., +911234567890)',
            'Tags should be comma-separated',
            'All other fields are optional',
          ],
        },
        'CSV template fetched successfully'
      );
    } catch (error) {
      next(error);
    }
  }

  // ==========================================
  // ✅ NEW: VALIDATE CSV FILE
  // ==========================================
  async validateCsvFile(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      if (!req.file) {
        throw new AppError('CSV file is required', 400);
      }

      console.log('🔍 Validating CSV file:', {
        filename: req.file.originalname,
        size: req.file.size,
      });

      const validation = await campaignUploadService.validateCsvFile(req.file.buffer);

      return sendSuccess(res, validation, 'CSV validation completed');
    } catch (error: any) {
      console.error('❌ CSV validation error:', error);

      if (error.message === 'Only CSV files are allowed') {
        return next(new AppError('Only CSV files are allowed', 400));
      }

      next(error);
    }
  }

  // ==========================================
  // GET FAILED CONTACTS
  // ==========================================
  async getFailedContacts(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const organizationId = req.user!.organizationId;
      if (!organizationId) {
        throw new AppError('Organization context required', 400);
      }

      const id = String(req.params.id);
      const { page = 1, limit = 100 } = req.query;

      const result = await campaignsService.getFailedContacts(
        organizationId,
        id,
        Number(page),
        Number(limit)
      );

      return res.json({
        success: true,
        message: 'Failed contacts fetched successfully',
        data: result.contacts,
        meta: result.meta,
      });
    } catch (error) {
      next(error);
    }
  }

  // ==========================================
  // EXPORT FAILED CONTACTS AS CSV
  // ==========================================
  async exportFailedContacts(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const organizationId = req.user!.organizationId;
      if (!organizationId) {
        throw new AppError('Organization context required', 400);
      }

      const id = String(req.params.id);
      const csvData = await campaignsService.exportFailedContactsCsv(organizationId, id);

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename=failed-contacts-${id}.csv`);
      return res.send(csvData);
    } catch (error) {
      next(error);
    }
  }

  // ==========================================
  // RETRY FAILED CONTACTS ONLY
  // ==========================================
  async retryFailedOnly(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const organizationId = req.user!.organizationId;
      if (!organizationId) {
        throw new AppError('Organization context required', 400);
      }

      const id = String(req.params.id);
      const { contactIds } = req.body; // Optional: specific contacts to retry

      const result = await campaignsService.retryFailedContacts(organizationId, id, contactIds);

      return sendSuccess(res, result, result.message);
    } catch (error) {
      next(error);
    }
  }

  // ==========================================
  // GET ALL RECIPIENTS WITH STATUS
  // ==========================================
  async getAllRecipients(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const organizationId = req.user!.organizationId;
      if (!organizationId) {
        throw new AppError('Organization context required', 400);
      }

      const id = String(req.params.id);
      const {
        page = 1,
        limit = 50,
        status,
        search,
      } = req.query;

      const result = await campaignsService.getAllRecipients(
        organizationId,
        id,
        {
          page: Number(page),
          limit: Number(limit),
          status: status as string,
          search: search as string,
        }
      );

      return res.json({
        success: true,
        message: 'Recipients fetched successfully',
        data: result.recipients,
        meta: result.meta,
        summary: result.summary,
      });
    } catch (error) {
      next(error);
    }
  }

  // ==========================================
  // EXPORT ALL RECIPIENTS AS CSV
  // ==========================================
  async exportRecipients(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const organizationId = req.user!.organizationId;
      if (!organizationId) {
        throw new AppError('Organization context required', 400);
      }

      const id = String(req.params.id);
      const { status } = req.query;

      const csvData = await campaignsService.exportRecipientsCsv(
        organizationId,
        id,
        status as string
      );

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename=campaign-recipients-${id}.csv`);
      return res.send(csvData);
    } catch (error) {
      next(error);
    }
  }

  // ==========================================
  // RETRY FAILED
  // ==========================================
  async retryFailed(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const organizationId = req.user!.organizationId;
      if (!organizationId) throw new AppError('Organization required', 400);

      const campaignId = req.params.campaignId || req.params.id;
      const { contactIds } = req.body;

      const result = await campaignsService.retryFailed(
        organizationId,
        String(campaignId),
        contactIds
      );

      return sendSuccess(res, result, 'Retry initiated');
    } catch (error) {
      next(error);
    }
  }

  // ==========================================
  // RESUME PENDING
  // ==========================================
  async resumePending(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const organizationId = req.user!.organizationId;
      if (!organizationId) throw new AppError('Organization required', 400);

      const campaignId = req.params.campaignId || req.params.id;

      const result = await campaignsService.resumePending(organizationId, String(campaignId));

      return sendSuccess(res, result, 'Campaign resumed');
    } catch (error) {
      next(error);
    }
  }

  // ==========================================
  // GET DETAILED STATS
  // ==========================================
  async getDetailedStats(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const organizationId = req.user!.organizationId;
      if (!organizationId) throw new AppError('Organization required', 400);

      const campaignId = req.params.campaignId || req.params.id;

      const result = await campaignsService.getDetailedStats(organizationId, String(campaignId));

      return sendSuccess(res, result, 'Stats fetched');
    } catch (error) {
      next(error);
    }
  }
}

// ==========================================
// EXPORT SINGLETON INSTANCE
// ==========================================
export const campaignsController = new CampaignsController();

// ==========================================
// EXPORT TYPES
// ==========================================
export type { AuthRequest };
// src/modules/campaigns/campaigns.socket.ts - PRODUCTION FIXED

import { Server as SocketServer } from 'socket.io';

let io: SocketServer | null = null;

export const initializeCampaignSocket = (socketServer: SocketServer) => {
  io = socketServer;

  io.on('connection', (socket) => {
    socket.on('campaign:join', (campaignId: string) => {
      if (campaignId) {
        socket.join(`campaign:${campaignId}`);
        console.log(`🔌 Joined campaign room: ${campaignId}`);
      }
    });

    socket.on('campaign:leave', (campaignId: string) => {
      if (campaignId) {
        socket.leave(`campaign:${campaignId}`);
      }
    });

    socket.on('org:join', (organizationId: string) => {
      if (organizationId) {
        socket.join(`org:${organizationId}`);
        socket.join(`org:${organizationId}:campaigns`);
      }
    });
  });

  console.log('✅ Campaign Socket Service initialized');
};

class CampaignSocketService {
  emitCampaignUpdate(
    organizationId: string,
    campaignId: string,
    data: {
      status: string;
      message: string;
      totalContacts?: number;
      sentCount?: number;
      deliveredCount?: number;
      readCount?: number;
      failedCount?: number;
    }
  ) {
    if (!io) return;

    const payload = {
      campaignId,
      organizationId,
      ...data,
      timestamp: new Date().toISOString(),
    };

    io.to(`org:${organizationId}`).emit('campaign:update', payload);
    io.to(`campaign:${campaignId}`).emit('campaign:update', payload);
    io.to(`org:${organizationId}:campaigns`).emit('campaign:update', payload);
  }

  /**
   * ✅ CRITICAL FIX: Progress emit with proper capped values
   * Backend sends CUMULATIVE numbers (sent = actually sent + delivered + read)
   */
  emitCampaignProgress(
    organizationId: string,
    campaignId: string,
    data: {
      sent: number;        // cumulative: sent + delivered + read
      failed: number;
      delivered: number;   // cumulative: delivered + read
      read: number;
      total: number;
      percentage: number;
      status: string;
    }
  ) {
    if (!io) return;

    const total = Math.max(data.total, 1);
    const sent = Math.min(Math.max(0, data.sent), total);
    const failed = Math.min(Math.max(0, data.failed), Math.max(0, total - sent));
    const delivered = Math.min(Math.max(0, data.delivered || 0), sent);
    const read = Math.min(Math.max(0, data.read || 0), delivered);
    const processed = Math.min(sent + failed, total);
    const percentage = Math.min(100, Math.round((processed / total) * 100));

    const payload = {
      campaignId,
      organizationId,
      sent,
      failed,
      delivered,
      read,
      total,
      percentage,
      status: data.status,
      timestamp: new Date().toISOString(),
    };

    io.to(`org:${organizationId}`).emit('campaign:progress', payload);
    io.to(`campaign:${campaignId}`).emit('campaign:progress', payload);
    io.to(`org:${organizationId}:campaigns`).emit('campaign:progress', payload);
  }

  emitContactStatus(
    organizationId: string,
    campaignId: string,
    data: {
      contactId: string;
      phone: string;
      status: string;
      messageId?: string;
      error?: string;
      sentAt?: string;
      deliveredAt?: string;
      readAt?: string;
      failedAt?: string;
    }
  ) {
    if (!io) return;

    const payload = {
      campaignId,
      organizationId,
      ...data,
      timestamp: new Date().toISOString(),
    };

    io.to(`org:${organizationId}`).emit('campaign:contact', payload);
    io.to(`campaign:${campaignId}`).emit('campaign:contact', payload);
    io.to(`campaign:${campaignId}`).emit('campaign:contact:status', payload);
  }

  emitCampaignCompleted(
    organizationId: string,
    campaignId: string,
    stats: {
      sentCount: number;
      failedCount: number;
      deliveredCount: number;
      readCount: number;
      totalRecipients: number;
    }
  ) {
    if (!io) return;

    const payload = {
      campaignId,
      organizationId,
      ...stats,
      timestamp: new Date().toISOString(),
    };

    io.to(`org:${organizationId}`).emit('campaign:completed', payload);
    io.to(`campaign:${campaignId}`).emit('campaign:completed', payload);
    io.to(`org:${organizationId}:campaigns`).emit('campaign:completed', payload);

    console.log(`🎉 Campaign completed: ${campaignId} | sent=${stats.sentCount} failed=${stats.failedCount}`);
  }

  emitCampaignError(organizationId: string, campaignId: string, error: { message: string; code?: string }) {
    if (!io) return;

    const payload = {
      campaignId,
      organizationId,
      ...error,
      timestamp: new Date().toISOString(),
    };

    io.to(`org:${organizationId}`).emit('campaign:error', payload);
    io.to(`campaign:${campaignId}`).emit('campaign:error', payload);
  }

  emitCsvUploadProgress(userId: string, data: any) {
    if (!io) return;
    io.to(`user:${userId}`).emit('csv:upload:progress', { ...data, timestamp: new Date().toISOString() });
  }

  emitContactValidation(userId: string, data: any) {
    if (!io) return;
    io.to(`user:${userId}`).emit('csv:validation:batch', { ...data, timestamp: new Date().toISOString() });
  }

  isInitialized(): boolean {
    return io !== null;
  }

  getIO(): SocketServer | null {
    return io;
  }
}

export const campaignSocketService = new CampaignSocketService();
export default campaignSocketService;
// src/modules/campaigns/campaigns.socket.ts - FIXED
import { Server as SocketServer } from 'socket.io';

let io: SocketServer | null = null;

// ✅ FIX Bug1: Guard against double initialization
export const initializeCampaignSocket = (socketServer: SocketServer) => {
  if (io) {
    console.warn('⚠️ Campaign socket already initialized');
    return;
  }

  io = socketServer;

  io.on('connection', (socket) => {
    // Campaign room
    socket.on('campaign:join', (campaignId: string) => {
      if (campaignId && typeof campaignId === 'string') {
        socket.join(`campaign:${campaignId}`);
      }
    });

    socket.on('campaign:leave', (campaignId: string) => {
      if (campaignId && typeof campaignId === 'string') {
        socket.leave(`campaign:${campaignId}`);
      }
    });

    // Org room
    socket.on('org:join', (organizationId: string) => {
      if (organizationId && typeof organizationId === 'string') {
        socket.join(`org:${organizationId}`);
        socket.join(`org:${organizationId}:campaigns`);
      }
    });
  });

  console.log('✅ Campaign Socket initialized');
};

// ✅ FIX Bug2: message field optional with default
class CampaignSocketService {
  private emit(
    rooms: string[],
    event: string,
    payload: object
  ): void {
    if (!io) return;
    const data = { ...payload, timestamp: new Date().toISOString() };
    rooms.forEach(room => io!.to(room).emit(event, data));
  }

  private getRooms(organizationId: string, campaignId: string): string[] {
    return [
      `org:${organizationId}`,
      `org:${organizationId}:campaigns`,
      `campaign:${campaignId}`,
    ];
  }

  // ✅ FIX Bug2: message is now optional
  emitCampaignUpdate(
    organizationId: string,
    campaignId: string,
    data: {
      status: string;
      message?: string;      // ✅ Optional now
      totalContacts?: number;
      sentCount?: number;
      deliveredCount?: number;
      readCount?: number;
      failedCount?: number;
    }
  ) {
    this.emit(
      this.getRooms(organizationId, campaignId),
      'campaign:update',
      { campaignId, organizationId, ...data }
    );
  }

  emitCampaignProgress(
    organizationId: string,
    campaignId: string,
    data: {
      sent: number;
      failed: number;
      delivered: number;
      read: number;
      total: number;
      percentage: number;
      status: string;
    }
  ) {
    const total = Math.max(data.total, 1);
    const sent = Math.min(Math.max(0, data.sent), total);
    const failed = Math.min(Math.max(0, data.failed), Math.max(0, total - sent));
    const delivered = Math.min(Math.max(0, data.delivered), sent);
    const read = Math.min(Math.max(0, data.read), delivered);
    const processed = Math.min(sent + failed, total);
    const pct = Math.min(100, Math.round((processed / total) * 100));

    this.emit(
      this.getRooms(organizationId, campaignId),
      'campaign:progress',
      {
        campaignId, organizationId,
        sent, failed, delivered, read,
        total, percentage: pct,
        status: data.status,
      }
    );
  }

  // ✅ FIX Bug3: Only send what backend actually has
  emitContactStatus(
    organizationId: string,
    campaignId: string,
    data: {
      contactId: string;
      phone: string;
      status: string;
      messageId?: string;
      error?: string;
    }
  ) {
    const payload = {
      campaignId,
      organizationId,
      contactId: data.contactId,
      phone: data.phone,
      status: data.status,
      messageId: data.messageId,
      error: data.error,
    };

    if (!io) return;
    const ts = new Date().toISOString();
    // Contact updates only to campaign room (not org-wide - too noisy)
    io.to(`campaign:${campaignId}`)
      .emit('campaign:contact', { ...payload, timestamp: ts });
    io.to(`campaign:${campaignId}`)
      .emit('campaign:contact:status', { ...payload, timestamp: ts });
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
    this.emit(
      this.getRooms(organizationId, campaignId),
      'campaign:completed',
      { campaignId, organizationId, ...stats }
    );
    console.log(
      `🎉 Campaign completed: ${campaignId} | ` +
      `sent=${stats.sentCount} failed=${stats.failedCount}`
    );
  }

  emitCampaignError(
    organizationId: string,
    campaignId: string,
    error: { message: string; code?: string }
  ) {
    this.emit(
      [
        `org:${organizationId}`,
        `campaign:${campaignId}`,
      ],
      'campaign:error',
      { campaignId, organizationId, ...error }
    );
  }

  emitCsvUploadProgress(userId: string, data: any) {
    if (!io) return;
    io.to(`user:${userId}`)
      .emit('csv:upload:progress', {
        ...data, timestamp: new Date().toISOString(),
      });
  }

  isInitialized(): boolean { return io !== null; }
  getIO(): SocketServer | null { return io; }
}

export const campaignSocketService = new CampaignSocketService();
export default campaignSocketService;
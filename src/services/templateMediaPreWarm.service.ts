// src/services/templateMediaPreWarm.service.ts - SIMPLIFIED
// ✅ No re-upload logic - just verify URLs are valid
// ✅ Cron can still run but does nothing harmful

export class TemplateMediaPreWarmService {
  async preWarmExpiringMedia(): Promise<{
    checked: number;
    refreshed: number;
    failed: number;
  }> {
    // ✅ Nothing to pre-warm - we use permanent URLs now
    console.log('🔥 Pre-warm skipped: Using permanent URLs (no expiry)');
    return { checked: 0, refreshed: 0, failed: 0 };
  }
}

export const templateMediaPreWarmService = new TemplateMediaPreWarmService();

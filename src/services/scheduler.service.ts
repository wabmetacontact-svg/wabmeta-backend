// ✅ OPTIMIZED: src/services/scheduler.service.ts

import cron from 'node-cron';
import { automationEngine } from '../modules/automation/automation.engine';

export function initializeScheduler() {
  console.log('⏰ Initializing automation scheduler...');

  // ✅ RESTORED: Run scheduled automations every 1 minute (was every 5 minutes)
  // This ensures automations trigger on time as expected by users
  cron.schedule('* * * * *', async () => {
    try {
      await automationEngine.triggerScheduled();
    } catch (error) {
      console.error('Scheduled automation error:', error);
    }
  });

  // ✅ OPTIMIZED: Check for inactive contacts every 1 hour (was every 4 hours)
  // This provides much better responsiveness for inactivity-based automations
  cron.schedule('0 * * * *', async () => {
    try {
      await automationEngine.triggerInactivity();
    } catch (error) {
      console.error('Inactivity automation error:', error);
    }
  });

  console.log('✅ Automation scheduler initialized');
}

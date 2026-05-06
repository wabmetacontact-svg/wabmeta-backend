"use strict";
// ✅ OPTIMIZED: src/services/scheduler.service.ts
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.initializeScheduler = initializeScheduler;
const node_cron_1 = __importDefault(require("node-cron"));
const automation_engine_1 = require("../modules/automation/automation.engine");
function initializeScheduler() {
    console.log('⏰ Initializing automation scheduler...');
    // ✅ RESTORED: Run scheduled automations every 1 minute (was every 5 minutes)
    // This ensures automations trigger on time as expected by users
    node_cron_1.default.schedule('* * * * *', async () => {
        try {
            await automation_engine_1.automationEngine.triggerScheduled();
        }
        catch (error) {
            console.error('Scheduled automation error:', error);
        }
    });
    // ✅ OPTIMIZED: Check for inactive contacts every 1 hour (was every 4 hours)
    // This provides much better responsiveness for inactivity-based automations
    node_cron_1.default.schedule('0 * * * *', async () => {
        try {
            await automation_engine_1.automationEngine.triggerInactivity();
        }
        catch (error) {
            console.error('Inactivity automation error:', error);
        }
    });
    console.log('✅ Automation scheduler initialized');
}
//# sourceMappingURL=scheduler.service.js.map
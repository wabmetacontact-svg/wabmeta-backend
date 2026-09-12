import prisma from '../../config/database';
import { whatsappService } from '../whatsapp/whatsapp.service';
import { automationService } from './automation.service';
import { AutomationTrigger } from '@prisma/client';
import { deductWalletForTemplate } from '../wallet/wallet.deduction.service';
import { automationLog } from '../../utils/logger';
import { notificationsService } from '../notifications/notifications.service';
import {
  ClaimedJob,
  cancelPendingJobs,
  claimDueJobs,
  deferJob,
  finishJob,
  retryOrFailJob,
  scheduleJob,
} from './automation.jobs';
import {
  FREE_FORM_ACTIONS,
  INLINE_DELAY_MAX_MS,
  delayToMs,
  isWindowOpen,
  quietHoursEndsAt,
  waitTimeoutMs,
} from './automation.timing';

interface AutomationAction {
  id: string;
  type: string;
  config: any;
}

interface TriggerContext {
  organizationId: string;
  contactId?: string;
  phone?: string;
  message?: string;
  conversationId?: string;
  metadata?: any;
}

class AutomationEngine {
  // ==========================================
  // ✅ GROUP CHECK HELPER
  // ==========================================
  private async isContactInTargetGroups(
    contactId: string,
    targetGroupIds: string[]
  ): Promise<boolean> {
    // If no groups specified, allow all
    if (!targetGroupIds || targetGroupIds.length === 0) {
      return true;
    }

    const membership = await prisma.contactGroupMember.findFirst({
      where: {
        contactId,
        groupId: { in: targetGroupIds },
      },
    });

    return !!membership;
  }

  // ==========================================
  // ✅ TRIGGER: UNKNOWN MESSAGE
  // ==========================================
  async triggerUnknownMessage(context: TriggerContext): Promise<boolean> {
    if (!context.phone) return false;
    let triggered = false;

    automationLog.debug('Checking UNKNOWN_MESSAGE triggers', {
      orgId: context.organizationId,
    });

    try {
      const automations = await automationService.getActiveByTrigger(
        context.organizationId, 'UNKNOWN_MESSAGE'
      );

      if (automations.length === 0) return false;

      const contactExistedBefore = await this.contactExistedBefore(
        context.organizationId, context.phone
      );

      for (const automation of automations) {
        try {
          if (automation.excludeExisting && contactExistedBefore) continue;

          if (context.contactId) {
            const recentRun = await prisma.automationSequence.findFirst({
              where: {
                automationId: automation.id,
                contactId: context.contactId,
                createdAt: { gt: new Date(Date.now() - 24 * 60 * 60 * 1000) },
              },
            });
            if (recentRun) continue;
          }

          if (context.contactId && automation.targetGroupIds?.length > 0) {
            const inGroup = await this.isContactInTargetGroups(
              context.contactId,
              automation.targetGroupIds
            );
            if (!inGroup) continue;
          }

          automationLog.info('Unknown message automation triggered', {
            name: automation.name,
            id: automation.id,
          });

          await this.executeSequence(automation.id, automation.actions, context);
          triggered = true;
        } catch (err: any) {
          automationLog.error('Unknown message automation failed', err, {
            automationId: automation.id,
          });
        }
      }
    } catch (error: any) {
      if (error?.code !== 'P2024') {
        automationLog.error('Unknown message trigger error', error);
      }
    }
    return triggered;
  }

  // ==========================================
  // ✅ NEW HELPER: Check if contact existed BEFORE now
  // ==========================================
  private async contactExistedBefore(
    organizationId: string,
    phone: string,
    toleranceMs: number = 10000 // 10 seconds tolerance
  ): Promise<boolean> {
    try {
      const cutoffTime = new Date(Date.now() - toleranceMs);
      
      const contact = await prisma.contact.findFirst({
        where: {
          organizationId,
          phone,
          createdAt: { lt: cutoffTime },
        },
        select: { id: true },
      });

      return !!contact;
    } catch (error: any) {
      if (error?.code === 'P2024') return false;
      throw error;
    }
  }

  // ==========================================
  // ✅ TRIGGER: KEYWORD (Enhanced with Groups)
  // ==========================================
  async triggerKeyword(context: TriggerContext): Promise<boolean> {
    if (!context.message) return false;

    automationLog.debug('Checking KEYWORD triggers', {
      orgId: context.organizationId,
      message: context.message.substring(0, 30),
    });

    try {
      const automations = await automationService.getActiveByTrigger(
        context.organizationId, 'KEYWORD'
      );

      let triggered = false;

      for (const automation of automations) {
        if (context.contactId && automation.targetGroupIds?.length > 0) {
          const inGroup = await this.isContactInTargetGroups(
            context.contactId, automation.targetGroupIds
          );
          if (!inGroup) continue;
        }

        const keywords: string[] = (automation.triggerConfig as any)?.keywords || [];
        const exactMatch = (automation.triggerConfig as any)?.exactMatch || false;
        const messageL = context.message.toLowerCase().trim();

        const matched = keywords.some((keyword) => {
          const keywordL = keyword.toLowerCase().trim();
          return exactMatch ? messageL === keywordL : messageL.includes(keywordL);
        });

        if (matched) {
          automationLog.info('Keyword automation triggered', {
            name: automation.name,
            id: automation.id,
          });
          await this.executeSequence(automation.id, automation.actions as any, context);
          triggered = true;
        }
      }

      return triggered;
    } catch (error: any) {
      automationLog.error('Keyword trigger error', error);
      return false;
    }
  }

  // ==========================================
  // ✅ TRIGGER: NEW CONTACT (Enhanced with Groups)
  // ==========================================
  async triggerNewContact(context: TriggerContext): Promise<boolean> {
    let triggered = false;
    console.log(`🤖 [AUTOMATION] Triggering NEW_CONTACT for org: ${context.organizationId}`);

    try {
      const automations = await automationService.getActiveByTrigger(
        context.organizationId,
        'NEW_CONTACT'
      );

      for (const automation of automations) {
        // ✅ Check target groups
        if (context.contactId && automation.targetGroupIds?.length > 0) {
          const inTargetGroup = await this.isContactInTargetGroups(
            context.contactId,
            automation.targetGroupIds
          );
          if (!inTargetGroup) {
            console.log(`⏭️ Contact not in target groups. Skipping: ${automation.name}`);
            continue;
          }
        }

        console.log(`🤖 Executing automation: ${automation.name}`);
        await this.executeSequence(automation.id, automation.actions as any, context);
        triggered = true;
      }
    } catch (error) {
      console.error('🤖 NEW_CONTACT automation error:', error);
    }
    return triggered;
  }

  // ==========================================
  // ✅ TRIGGER: Webhook
  // ==========================================
  async triggerWebhook(
    organizationId: string,
    automationId: string,
    context: TriggerContext
  ): Promise<void> {
    console.log(`🤖 Triggering webhook automation: ${automationId}`);
    try {
      const automation = await automationService.getById(organizationId, automationId);

      if (!automation.isActive || automation.trigger !== 'WEBHOOK') {
        console.log('🤖 Automation not active or not webhook type');
        return;
      }

      await this.executeSequence(automation.id, automation.actions as any, context);
    } catch (error) {
      console.error('🤖 Webhook automation error:', error);
    }
  }

  // ==========================================
  // ✅ FIXED: TRIGGER: Scheduled (Time-based)
  // ==========================================
  async triggerScheduled(): Promise<void> {
    try {
      const now = new Date();
      const currentHHMM = now.toTimeString().substring(0, 5); // "09:30"
      const currentDay = now.getDay(); // 0=Sun, 1=Mon, ..., 6=Sat
      const isWeekday = currentDay >= 1 && currentDay <= 5;
      const isWeekend = currentDay === 0 || currentDay === 6;
      let triggeredCount = 0;

      if (process.env.LOG_SCHEDULER === 'verbose') {
        console.log(`⏰ [SCHEDULE] Checking triggers at ${currentHHMM} (day ${currentDay})`);
      }

      // ✅ FIX: undefined orgId = get all orgs
      const automations = await automationService.getActiveByTrigger(undefined, 'SCHEDULE');

      if (automations.length === 0) {
        return; // No scheduled automations
      }

      console.log(`⏰ [SCHEDULE] Found ${automations.length} scheduled automation(s)`);

      for (const automation of automations) {
        try {
          const config = automation.triggerConfig as any;
          const scheduledTime = config?.time || '09:00'; // Default 9 AM
          const days = config?.days || 'daily'; // daily | weekdays | weekends

          // ✅ Check if today matches recursion
          let shouldRunToday = false;
          if (days === 'daily') shouldRunToday = true;
          else if (days === 'weekdays' && isWeekday) shouldRunToday = true;
          else if (days === 'weekends' && isWeekend) shouldRunToday = true;

          if (!shouldRunToday) {
            console.log(`⏭️ [SCHEDULE] ${automation.name}: Not scheduled for today (${days})`);
            continue;
          }

          // ✅ Check if current time matches (with 1-minute tolerance)
          const [schedHour, schedMin] = scheduledTime.split(':').map(Number);
          const [currHour, currMin] = currentHHMM.split(':').map(Number);
          
          const schedMinutes = schedHour * 60 + schedMin;
          const currMinutes = currHour * 60 + currMin;
          const diffMinutes = Math.abs(schedMinutes - currMinutes);

          if (diffMinutes > 1) {
            // Not the scheduled time yet
            continue;
          }

          // ✅ CRITICAL: Prevent duplicate runs on same day
          if (automation.lastExecutedAt) {
            const lastRun = new Date(automation.lastExecutedAt);
            const lastRunDate = lastRun.toDateString();
            const todayDate = now.toDateString();
            
            if (lastRunDate === todayDate) {
              console.log(`⏭️ [SCHEDULE] ${automation.name}: Already ran today`);
              continue;
            }
          }

          triggeredCount++;
          console.log(`🚀 [SCHEDULE] Executing: ${automation.name} for org: ${automation.organizationId}`);

          // ✅ Get target contacts
          const targetGroupIds = (automation.targetGroupIds as string[]) || [];
          let contacts: any[] = [];

          try {
            if (targetGroupIds.length > 0) {
              contacts = await prisma.contact.findMany({
                where: {
                  organizationId: automation.organizationId,
                  status: 'ACTIVE',
                  groupMemberships: {
                    some: { groupId: { in: targetGroupIds } },
                  },
                },
                select: { id: true, phone: true, firstName: true },
                take: 500, // Safety limit
              });
            } else {
              // No groups = ALL active contacts
              contacts = await prisma.contact.findMany({
                where: {
                  organizationId: automation.organizationId,
                  status: 'ACTIVE',
                },
                select: { id: true, phone: true, firstName: true },
                take: 500,
              });
            }
          } catch (dbErr: any) {
            if (dbErr?.code === 'P2024') {
              console.warn(`⚠️ [SCHEDULE] DB busy, skipping ${automation.name}`);
              continue;
            }
            throw dbErr;
          }

          console.log(`📇 [SCHEDULE] ${automation.name}: ${contacts.length} contacts targeted`);

          if (contacts.length === 0) {
            console.log(`⏭️ [SCHEDULE] No contacts found for ${automation.name}`);
            // Still mark as executed for the day
            await automationService.incrementExecutionCount(automation.id);
            continue;
          }

          // ✅ Mark as executed BEFORE processing (prevents duplicates)
          await automationService.incrementExecutionCount(automation.id);

          // ✅ Execute sequentially with small delay (avoid rate limits)
          for (const contact of contacts) {
            try {
              await this.executeSequence(automation.id, automation.actions as any, {
                organizationId: automation.organizationId,
                contactId: contact.id,
                phone: contact.phone,
              });
              // Small delay between contacts (200ms)
              await new Promise((r) => setTimeout(r, 200));
            } catch (err: any) {
              console.error(`❌ [SCHEDULE] Failed for contact ${contact.id}:`, err.message);
            }
          }

          console.log(`✅ [SCHEDULE] Completed: ${automation.name}`);
        } catch (err: any) {
          if (err?.code !== 'P2024') {
            console.error(`❌ [SCHEDULE] Automation ${automation.id} failed:`, err.message);
          }
        }
      }

      if (triggeredCount > 0) {
        console.log(`✅ [SCHEDULE] Fired ${triggeredCount} triggers at ${currentHHMM}`);
      }
    } catch (error: any) {
      if (error?.code !== 'P2024') {
        console.error('🤖 Scheduled automation trigger error:', error);
      }
    }
  }

  // ==========================================
  // ✅ FIXED: TRIGGER: Contact Inactivity
  // ==========================================
  async triggerInactivity(): Promise<void> {
    try {
      console.log(`💤 [INACTIVITY] Starting inactivity check...`);

      // ✅ FIX: undefined orgId = get all orgs
      const automations = await automationService.getActiveByTrigger(undefined, 'INACTIVITY');

      if (automations.length === 0) {
        return;
      }

      console.log(`💤 [INACTIVITY] Found ${automations.length} automation(s)`);

      for (const automation of automations) {
        try {
          const config = automation.triggerConfig as any;
          const hours = Number(config?.hours) || 24;
          const inactiveSince = new Date(Date.now() - hours * 60 * 60 * 1000);

          console.log(`💤 [INACTIVITY] ${automation.name}: checking ${hours}h inactive`);

          // ✅ Target contacts (with group filtering)
          const targetGroupIds = (automation.targetGroupIds as string[]) || [];

          const whereClause: any = {
            organizationId: automation.organizationId,
            status: 'ACTIVE',
            lastMessageAt: { lt: inactiveSince, not: null },
          };

          if (targetGroupIds.length > 0) {
            whereClause.groupMemberships = {
              some: { groupId: { in: targetGroupIds } },
            };
          }

          let contacts: any[] = [];
          try {
            contacts = await prisma.contact.findMany({
              where: whereClause,
              select: {
                id: true,
                phone: true,
                firstName: true,
                lastMessageAt: true,
              },
              take: 100, // Safety limit
              orderBy: { lastMessageAt: 'asc' }, // Oldest first
            });
          } catch (dbErr: any) {
            if (dbErr?.code === 'P2024') {
              console.warn(`⚠️ [INACTIVITY] DB busy, skipping ${automation.name}`);
              continue;
            }
            throw dbErr;
          }

          if (contacts.length === 0) {
            continue;
          }

          // ✅ Filter out contacts who already got this inactivity message recently
          const contactIds = contacts.map((c) => c.id);
          const recentSequences = await prisma.automationSequence.findMany({
            where: {
              automationId: automation.id,
              contactId: { in: contactIds },
              // Already ran within cooldown period (e.g. within last inactivity window)
              lastStepAt: { gt: inactiveSince },
            },
            select: { contactId: true },
          });

          const alreadyRunSet = new Set(recentSequences.map((s) => s.contactId));
          const eligibleContacts = contacts.filter((c) => !alreadyRunSet.has(c.id));

          console.log(
            `💤 [INACTIVITY] ${automation.name}: ${contacts.length} inactive, ` +
            `${eligibleContacts.length} eligible (${alreadyRunSet.size} skipped)`
          );

          if (eligibleContacts.length === 0) continue;

          await automationService.incrementExecutionCount(automation.id);

          // ✅ Execute sequentially with delay
          for (const contact of eligibleContacts) {
            try {
              await this.executeSequence(automation.id, automation.actions as any, {
                organizationId: automation.organizationId,
                contactId: contact.id,
                phone: contact.phone,
              });
              await new Promise((r) => setTimeout(r, 300));
            } catch (err: any) {
              console.error(`❌ [INACTIVITY] Failed for ${contact.id}:`, err.message);
            }
          }

          console.log(`✅ [INACTIVITY] Completed: ${automation.name}`);
        } catch (err: any) {
          if (err?.code !== 'P2024') {
            console.error(`❌ [INACTIVITY] Automation ${automation.id} failed:`, err.message);
          }
        }
      }
    } catch (error: any) {
      if (error?.code !== 'P2024') {
        console.error('🤖 Inactivity automation trigger error:', error);
      }
    }
  }

  // ==========================================
  // ✅ COMPATIBILITY: Handle Button Click
  // ==========================================
  async handleButtonClick(context: {
    organizationId: string;
    contactId: string;
    buttonId: string;
    conversationId: string;
  }): Promise<boolean> {
    return this.handleUserResponse({
      organizationId: context.organizationId,
      contactId: context.contactId,
      response: context.buttonId,
      conversationId: context.conversationId,
    });
  }

  // ==========================================
  // ✅ EXECUTE SEQUENCE (Multi-step with wait)
  // ==========================================
  // Trigger se naya run: step 0 se, purane run ka bacha follow-up hata kar.
  private async executeSequence(
    automationId: string,
    actions: AutomationAction[],
    context: TriggerContext
  ): Promise<void> {
    await this.runSteps(automationId, actions, 0, context, true);
  }

  /**
   * `actions` hamesha automation ki POORI list hai aur `startStep` usme
   * absolute index. Pehle resume par bachi hui list ka slice aata tha aur
   * currentStep us slice ke hisaab se 0 se ginta tha - doosre
   * wait_for_response ke baad sequence galat step se chalti thi.
   */
  private async runSteps(
    automationId: string,
    actions: AutomationAction[],
    startStep: number,
    context: TriggerContext,
    fresh: boolean
  ): Promise<void> {
    console.log(`🔄 Executing sequence: steps ${startStep + 1}-${actions.length}`);

    // Create or get contact
    let contactId = context.contactId;
    if (!contactId && context.phone) {
      const contact = await prisma.contact.upsert({
        where: {
          organizationId_phone: {
            organizationId: context.organizationId,
            phone: context.phone,
          },
        },
        create: {
          organizationId: context.organizationId,
          phone: context.phone,
          countryCode: '+91',
          firstName: 'Unknown',
          status: 'ACTIVE',
          source: 'WHATSAPP_AUTOMATION',
        },
        update: {},
      });
      contactId = contact.id;
    }

    if (!contactId) {
      console.error('❌ No contact ID available');
      return;
    }

    // Opt-out (STOP) ya blocked contact ko automation kuch nahi bhejti, trigger
    // chahe kuch bhi ho. Phone bhi yahin se: button click aur job ke context me
    // phone nahi hota tha, aur send actions chup-chaap return ho jate the.
    const contact = await prisma.contact.findUnique({
      where: { id: contactId },
      select: { status: true, phone: true },
    });
    if (!contact) return;
    if (contact.status !== 'ACTIVE') {
      console.log(`⏭️ Contact ${contactId} is ${contact.status} - automation skipped`);
      await prisma.automationSequence.updateMany({
        where: { automationId, contactId, status: { in: ['ACTIVE', 'SCHEDULED', 'WAITING'] } },
        data: { status: 'STOPPED' },
      });
      return;
    }
    context = { ...context, contactId, phone: context.phone || contact.phone };

    if (fresh) {
      // Naya trigger purane run ki jagah leta hai - uska bacha hua follow-up
      // is naye run ke upar na chale.
      await cancelPendingJobs({ contactId, automationId }, 'restarted by a new trigger');

      await prisma.automationSequence.upsert({
        where: {
          automationId_contactId: {
            automationId,
            contactId,
          },
        },
        create: {
          automationId,
          contactId,
          currentStep: 0,
          status: 'ACTIVE',
        },
        update: {
          currentStep: 0,
          status: 'ACTIVE',
        },
      });
    }

    // Window ek run me ek hi baar poochte hain - template bhejne se wo khulti nahi.
    let windowOpen: boolean | undefined;

    // Execute actions
    for (let i = startStep; i < actions.length; i++) {
      const action = actions[i];

      try {
        console.log(`🤖 Step ${i + 1}: ${action.type}`);

        // Update progress
        await prisma.automationSequence.updateMany({
          where: { automationId, contactId },
          data: { currentStep: i, lastStepAt: new Date() },
        });

        // 24 ghante ki window band ho to text/media Meta tak jata hi nahi
        // (sendMessage 400 deta hai). fallbackTemplateId ho to template bhejo.
        if (FREE_FORM_ACTIONS.has(action.type)) {
          if (windowOpen === undefined) {
            windowOpen = await this.isWindowOpenFor(context.organizationId, contactId);
          }
          if (!windowOpen) {
            const fallbackTemplateId = action.config?.fallbackTemplateId;
            if (fallbackTemplateId) {
              console.log(`🪟 Step ${i + 1}: 24h window closed - sending fallback template`);
              await this.actionSendTemplate(
                { ...context, contactId },
                { templateId: fallbackTemplateId, _automationId: automationId }
              );
            } else {
              console.warn(
                `🪟 Step ${i + 1}: 24h window closed - skipped ${action.type} ` +
                `(set fallbackTemplateId to send a template instead)`
              );
            }
            continue;
          }
        }

        switch (action.type) {
          case 'send_text':
          case 'send_message':
            await this.actionSendText({ ...context, contactId }, action.config);
            break;

          case 'send_audio':
            await this.actionSendMedia({ ...context, contactId }, 'audio', action.config);
            break;

          case 'send_video':
            await this.actionSendMedia({ ...context, contactId }, 'video', action.config);
            break;

          case 'send_image':
            await this.actionSendMedia({ ...context, contactId }, 'image', action.config);
            break;

          case 'send_document':
            await this.actionSendMedia({ ...context, contactId }, 'document', action.config);
            break;

          case 'send_buttons':
            await this.actionSendButtons({ ...context, contactId }, action.config);
            break;

          case 'send_template':
            await this.actionSendTemplate({ ...context, contactId }, { ...action.config, _automationId: automationId });
            break;

          case 'wait_for_response':
            await this.actionWaitForResponse(
              automationId, { ...context, contactId }, action.config, i, actions
            );
            return; // Pause until user responds

          case 'delay': {
            const ms = delayToMs(action.config);
            if (ms <= INLINE_DELAY_MAX_MS) {
              await new Promise((resolve) => setTimeout(resolve, ms));
              break;
            }
            if (i + 1 >= actions.length) break; // delay ke baad koi step hi nahi

            // Lamba delay: process me intezar nahi, job. Scheduler runAt par
            // agle step se chalayega - restart ke baad bhi.
            const runAt = new Date(Date.now() + ms);
            await scheduleJob({
              organizationId: context.organizationId,
              automationId,
              contactId,
              type: 'RESUME_SEQUENCE',
              runAt,
              payload: {
                fromStep: i + 1,
                nextActionId: actions[i + 1]?.id,
                phone: context.phone,
                conversationId: context.conversationId,
              },
            });
            await prisma.automationSequence.updateMany({
              where: { automationId, contactId },
              data: { status: 'SCHEDULED', currentStep: i },
            });
            console.log(`⏰ Step ${i + 1}: next step scheduled for ${runAt.toISOString()}`);
            return;
          }

          case 'add_tag':
            await this.actionAddTag({ ...context, contactId }, action.config);
            break;

          case 'add_to_group':
            await this.actionAddToGroup({ ...context, contactId }, action.config);
            break;

          case 'create_lead':
            await this.actionCreateLead({ ...context, contactId }, action.config);
            break;

          case 'send_payment_link':
            await this.actionSendPaymentLink({ ...context, contactId }, action.config);
            break;

          default:
            console.warn(`⚠️ Unknown action: ${action.type}`);
        }
      } catch (error: any) {
        console.error(`❌ Step ${i + 1} failed:`, error.message);
        // delay/wait schedule na ho paya to agle steps abhi chal jate -
        // follow-up bina intezar ke. Us se behtar run yahin rok dena.
        if (action.type === 'delay' || action.type === 'wait_for_response') {
          await prisma.automationSequence.updateMany({
            where: { automationId, contactId },
            data: { status: 'FAILED' },
          }).catch(() => {});
          return;
        }
      }
    }

    // Mark complete
    await prisma.automationSequence.updateMany({
      where: { automationId, contactId },
      data: { status: 'COMPLETED' },
    });

    await automationService.incrementExecutionCount(automationId);
  }

  // ==========================================
  // ✅ ACTION: SEND TEXT
  // ==========================================
  private async actionSendText(context: TriggerContext, config: any): Promise<void> {
    const account = await this.getDefaultAccount(context.organizationId);
    if (!account || !context.phone) return;

    const message = await this.replaceVariables(config.text || config.message || '', context);

    await whatsappService.sendTextMessage(
      account.id,
      context.phone,
      message,
      context.conversationId,
      context.organizationId
    );

    console.log(`✅ Sent text to ${context.phone}`);
  }

  // ==========================================
  // ✅ ACTION: SEND MEDIA (Audio/Video/Image/Document)
  // ==========================================
  private async actionSendMedia(
    context: TriggerContext,
    mediaType: 'audio' | 'video' | 'image' | 'document',
    config: any
  ): Promise<void> {
    const account = await this.getDefaultAccount(context.organizationId);
    if (!account || !context.phone) return;

    const mediaUrl = config.audioUrl || config.videoUrl || config.imageUrl || config.documentUrl || config.url;
    if (!mediaUrl) {
      console.warn(`⚠️ No ${mediaType} URL provided`);
      return;
    }

    await whatsappService.sendMediaMessage(
      account.id,
      context.phone,
      mediaType,
      mediaUrl,
      config.caption,
      context.conversationId,
      context.organizationId
    );

    console.log(`✅ Sent ${mediaType} to ${context.phone}`);
  }

  // ==========================================
  // ✅ ACTION: SEND BUTTONS (Interactive)
  // ==========================================
  private async actionSendButtons(context: TriggerContext, config: any): Promise<void> {
    const account = await this.getDefaultAccount(context.organizationId);
    if (!account || !context.phone) return;

    const buttons = config.buttons || [];
    if (buttons.length === 0) {
      console.warn('⚠️ No buttons configured');
      return;
    }

    const text = await this.replaceVariables(config.text || 'Please select:', context);

    const interactivePayload = {
      type: 'button',
      body: { text },
      action: {
        buttons: buttons.slice(0, 3).map((btn: any, i: number) => ({
          type: 'reply',
          reply: {
            id: btn.id || `btn_${i}`,
            title: btn.text.substring(0, 20), // Max 20 chars
          },
        })),
      },
    };

    await (whatsappService as any).sendMessage({
      accountId: account.id,
      to: context.phone,
      type: 'interactive',
      content: { interactive: interactivePayload },
      conversationId: context.conversationId,
      organizationId: context.organizationId,
    });

    console.log(`✅ Sent buttons to ${context.phone}`);
  }

  // ==========================================
  // ✅ ACTION: SEND TEMPLATE
  // ==========================================
  private async actionSendTemplate(
    context: TriggerContext,
    config: any
  ): Promise<void> {

    if (!config.templateId) {
      console.error('❌ [send_template] templateId missing:', config);
      return;
    }

    if (!context.phone) {
      console.error('❌ [send_template] phone missing:', context);
      return;
    }

    const account = await this.getDefaultAccount(context.organizationId);
    if (!account) {
      console.error(`❌ [send_template] No WhatsApp account for org: ${context.organizationId}`);
      return;
    }

    const template = await prisma.template.findUnique({
      where: { id: config.templateId },
    });

    if (!template) {
      console.error(`❌ [send_template] Template not found: ${config.templateId}`);
      return;
    }

    if (template.status !== 'APPROVED') {
      console.error(`❌ [send_template] Template "${template.name}" is "${template.status}" - not APPROVED`);
      return;
    }

    console.log(`📋 [send_template] Sending: ${template.name} → ${context.phone}`);
    console.log(`📋 [send_template] Template details:`, {
      headerType: template.headerType,
      headerMediaId: template.headerMediaId,
      headerContent: template.headerContent,
    });

    // ============================================
    // ✅ LANGUAGE MAPPING
    // ============================================
    const toMetaLang = (lang?: string): string => {
      const l = String(lang || '').trim();
      if (!l) return 'en_US';
      if (l.includes('_') || l.length <= 3) return l; // Already formatted
      const mapping: Record<string, string> = {
        english: 'en_US', hindi: 'hi',
        spanish: 'es_ES', portuguese: 'pt_BR',
        french: 'fr_FR', german: 'de_DE',
        italian: 'it_IT', arabic: 'ar',
      };
      return mapping[l.toLowerCase()] || l;
    };

    // ============================================
    // ✅ HELPER FUNCTIONS
    // ============================================
    const isValidHttpUrl = (str: string): boolean => {
      try {
        const url = new URL(str);
        return url.protocol === 'http:' || url.protocol === 'https:';
      } catch {
        return false;
      }
    };

    const isExpiredWhatsAppHandle = (str: string): boolean => {
      // "4:V2hhdH..." format = upload handle (expires in ~10min)
      return /^\d+:[A-Za-z0-9+/=:_-]+$/.test(str);
    };

    const isPureIntegerId = (str: string): boolean => {
      return /^\d{10,}$/.test(str);
    };

    /**
     * ✅ CORRECT media param builder
     * 
     * Meta Template Send API rules:
     *   { link: "https://..." }  → Valid CDN/Cloudinary URL ✅
     *   { id: 1234567890 }       → Numeric media ID (integer) ✅  
     *   { id: "4:V2hh..." }      → INVALID - upload handle ❌
     *   { link: "4:V2hh..." }    → INVALID - not a URL ❌
     */
    const buildMediaParam = (
      mediaType: string,
      mediaValue: string
    ): { type: string; [key: string]: any } | null => {
      const type = mediaType.toLowerCase();

      if (isValidHttpUrl(mediaValue)) {
        // ✅ Cloudinary/S3/CDN URL - best option
        console.log(`🔗 [template] Using URL for ${type}: ${mediaValue.substring(0, 60)}...`);
        return {
          type,
          [type]: { link: mediaValue }
        };

      } else if (isPureIntegerId(mediaValue)) {
        // ✅ Pure numeric ID - permanent, use as integer
        console.log(`🔢 [template] Using numeric Media ID for ${type}: ${mediaValue}`);
        return {
          type,
          [type]: { id: parseInt(mediaValue, 10) }
        };

      } else if (isExpiredWhatsAppHandle(mediaValue)) {
        // ❌ Upload handle - only valid during template CREATION, not sending
        console.error(`❌ [template] WhatsApp upload handle detected - CANNOT use for sending!`);
        console.error(`   Handle: ${mediaValue.substring(0, 50)}...`);
        console.error(`   These handles expire in ~10 min after upload.`);
        return null;

      } else {
        // Unknown - try as URL
        console.warn(`⚠️ [template] Unknown media format, attempting as link`);
        return {
          type,
          [type]: { link: mediaValue }
        };
      }
    };

    // ============================================
    // ✅ BUILD COMPONENTS - FIXED PRIORITY ORDER
    // ============================================
    let components = config.components || [];

    if (components.length === 0) {

      // ── HEADER COMPONENT ──────────────────────
      if (template.headerType && template.headerType !== 'NONE') {
        const hType = template.headerType.toUpperCase();

        if (['IMAGE', 'VIDEO', 'DOCUMENT'].includes(hType)) {
          
          /**
           * ✅ PRIORITY ORDER (Most reliable → Least reliable):
           * 
           * 1. headerContent + isValidHttpUrl  → Cloudinary URL (PERMANENT) ✅
           * 2. headerMediaId + isPureIntegerId → Numeric Meta ID (PERMANENT) ✅  
           * 3. Skip                            → Handle expired, can't send ❌
           * 
           * NEVER use "4:xxx" upload handles for SENDING
           * They are only for template CREATION (header_handle field)
           */

          const cloudinaryUrl = template.headerContent && isValidHttpUrl(template.headerContent)
            ? template.headerContent
            : null;

          const numericId = template.headerMediaId && isPureIntegerId(template.headerMediaId)
            ? template.headerMediaId
            : null;

          const mediaValue = cloudinaryUrl || numericId;

          if (mediaValue) {
            const mediaParam = buildMediaParam(hType.toLowerCase(), mediaValue);

            if (mediaParam) {
              components.push({
                type: 'header',
                parameters: [mediaParam]
              });
              console.log(`✅ [template] Header ${hType} built using: ${cloudinaryUrl ? 'Cloudinary URL' : 'Numeric ID'}`);
            }
          } else {
            // Both are unusable
            console.error(`❌ [template] No valid media for ${hType} header!`);
            console.error(`   headerContent: ${template.headerContent?.substring(0, 60) || 'null'}`);
            console.error(`   headerMediaId: ${template.headerMediaId?.substring(0, 40) || 'null'}`);
            console.error(`   Solution: Re-upload image in Templates page`);

            // ❌ Template send nahi hoga - throw karo clear message ke saath
            throw new Error(
              `Template "${template.name}" has expired media. ` +
              `Please re-upload the image/video in the Templates section.`
            );
          }

        } else if (hType === 'TEXT' && template.headerContent) {
          // Text header - variables fill karo
          if (template.headerContent.includes('{{1}}')) {
            let contactName = 'Customer';
            if (context.contactId) {
              const contact = await prisma.contact.findUnique({
                where: { id: context.contactId },
                select: { firstName: true, lastName: true }
              });
              if (contact?.firstName && contact.firstName !== 'Unknown') {
                contactName = [contact.firstName, contact.lastName]
                  .filter(Boolean).join(' ');
              }
            }
            components.push({
              type: 'header',
              parameters: [{ type: 'text', text: contactName }]
            });
          }
          // No variables in text header = no parameters needed
        }
      }

      // ── BODY COMPONENT ────────────────────────
      const bodyText = template.bodyText || '';
      const bodyVarMatches = bodyText.match(/\{\{(\d+)\}\}/g) || [];

      if (bodyVarMatches.length > 0) {
        let contactName = 'Customer';

        if (context.contactId) {
          const contact = await prisma.contact.findUnique({
            where: { id: context.contactId },
            select: { firstName: true, lastName: true }
          });
          if (contact?.firstName && contact.firstName !== 'Unknown') {
            contactName = [contact.firstName, contact.lastName]
              .filter(Boolean).join(' ');
          }
        }

        const bodyParams = bodyVarMatches.map((_, i) => ({
          type: 'text',
          text: i === 0 ? contactName : 'Customer'
        }));

        components.push({ type: 'body', parameters: bodyParams });
      }

      // ── BUTTON COMPONENTS ─────────────────────
      if (template.buttons) {
        const buttons = typeof template.buttons === 'string'
          ? JSON.parse(template.buttons)
          : template.buttons;

        if (Array.isArray(buttons)) {
          buttons.forEach((btn: any, index: number) => {
            if (btn.type === 'URL' && btn.url?.includes('{{')) {
              components.push({
                type: 'button',
                sub_type: 'url',
                index,
                parameters: [{ type: 'text', text: '' }]
              });
            }
          });
        }
      }
    }

    console.log(`📋 [template] Final components:`, JSON.stringify(components, null, 2));

    // ============================================
    // ✅ SEND TEMPLATE
    // ============================================
    try {
      const result = await whatsappService.sendTemplateMessage({
        accountId: account.id,
        to: context.phone,
        templateName: template.name,
        templateLanguage: toMetaLang(template.language),
        components,
        conversationId: context.conversationId,
        organizationId: context.organizationId,
      });

      console.log(`✅ [send_template] Sent! waMessageId: ${result.waMessageId}`);

      // ✅ Wallet deduction (non-blocking)
      deductWalletForTemplate({
        organizationId: context.organizationId,
        templateName: template.name,
        templateCategory: (template as any).category,
        recipientPhone: context.phone,
        waMessageId: result.waMessageId,
        automationId: config._automationId,
        automationName: `Automation → ${template.name}`,
      }).then(r => {
        if (r.deducted) console.log(`💳 Wallet: -₹${r.amount} for automation template`);
      }).catch(e => {
        console.error('💳 Wallet deduction error (non-blocking):', e.message);
      });

    } catch (error: any) {
      console.error(`❌ [send_template] Failed "${template.name}":`, {
        error: error.message,
        phone: context.phone,
        templateId: config.templateId,
      });
      throw error;
    }
  }

  // ==========================================
  // ✅ ACTION: WAIT FOR RESPONSE
  // ==========================================
  /**
   * config:
   *   buttonIds / keywords        kaunsa reply gina jaye (khali = koi bhi reply)
   *   onReply:   'continue' | 'stop'   reply aaye to aage chalo (default) ya ruko
   *   onTimeout: 'continue' | 'stop'   itni der reply na aaye to
   *   timeoutValue + timeoutUnit  (ya purana `timeout`, ms me)
   *
   * Follow-up ka pattern: quote bhejo -> wait(24h, onReply stop, onTimeout
   * continue) -> follow-up -> wait(48h, ...) -> aakhri follow-up.
   */
  private async actionWaitForResponse(
    automationId: string,
    context: TriggerContext & { contactId: string },
    config: any,
    stepIndex: number,
    actions: AutomationAction[]
  ): Promise<void> {
    console.log(`⏸️ Pausing sequence until user responds`);

    const onTimeout =
      config.onTimeout === 'continue' || config.onTimeout === 'stop' ? config.onTimeout : null;
    const timeoutMs = waitTimeoutMs(config);

    await prisma.automationSequence.updateMany({
      where: { automationId, contactId: context.contactId },
      data: {
        status: 'WAITING',
        currentStep: stepIndex,
        metadata: {
          waitingFor: config.buttonIds || config.keywords || [],
          timeout: timeoutMs || 24 * 60 * 60 * 1000,
          onReply: config.onReply === 'stop' ? 'stop' : 'continue',
          onTimeout,
        },
      },
    });

    // Timeout sirf tab jab builder ne bataya ho ki timeout par kya karna hai -
    // purane automations bina timeout ke hamesha intezar karte the.
    if (onTimeout && timeoutMs) {
      const runAt = new Date(Date.now() + timeoutMs);
      await scheduleJob({
        organizationId: context.organizationId,
        automationId,
        contactId: context.contactId,
        type: 'WAIT_TIMEOUT',
        runAt,
        payload: {
          fromStep: stepIndex + 1,
          nextActionId: actions[stepIndex + 1]?.id,
          phone: context.phone,
          conversationId: context.conversationId,
        },
      });
      console.log(`⏰ No-reply timeout (${onTimeout}) at ${runAt.toISOString()}`);
    }
  }

  // ==========================================
  // ✅ ACTION: ADD TO GROUP
  // ==========================================
  private async actionAddToGroup(context: TriggerContext, config: any): Promise<void> {
    if (!context.contactId || !config.groupId) return;

    await prisma.contactGroupMember.upsert({
      where: {
        groupId_contactId: {
          groupId: config.groupId,
          contactId: context.contactId,
        },
      },
      create: {
        groupId: config.groupId,
        contactId: context.contactId,
      },
      update: {},
    });

    console.log(`✅ Added contact to group: ${config.groupId}`);
  }

  // ==========================================
  // ✅ INBOUND MESSAGE (reply ka asar)
  // ==========================================
  /**
   * Customer ka har inbound message - text ho ya button. Webhook ise baaki
   * triggers se PEHLE await karta hai: warna isi message se shuru hua naya
   * run turant "reply aa gaya" samajh kar ruk jata.
   *
   * Pehle sirf button click yahan aata tha, isliye text reply par
   * wait_for_response kabhi aage nahi badhta tha.
   */
  async onInboundMessage(context: {
    organizationId: string;
    contactId: string;
    conversationId?: string;
    phone?: string;
    message?: string;
    buttonId?: string;
  }): Promise<boolean> {
    try {
      await this.stopFollowUpsOnReply(context.contactId);
    } catch (error: any) {
      console.error('❌ stopOnReply error:', error.message);
    }

    // true = kisi wait_for_response wale run ne is reply par aage chalna shuru kiya
    const response = context.buttonId || context.message || '';
    if (!response) return false;
    return this.handleUserResponse({ ...context, response });
  }

  /** Reply aate hi scheduled follow-ups band - jab tak automation stopOnReply: false na kahe. */
  private async stopFollowUpsOnReply(contactId: string): Promise<void> {
    if (!contactId) return;

    const scheduled = await prisma.automationSequence.findMany({
      where: { contactId, status: 'SCHEDULED' },
      select: {
        id: true,
        automationId: true,
        automation: { select: { name: true, triggerConfig: true } },
      },
    });

    for (const seq of scheduled) {
      if ((seq.automation.triggerConfig as any)?.stopOnReply === false) continue;

      const cancelled = await cancelPendingJobs(
        { contactId, automationId: seq.automationId, type: 'RESUME_SEQUENCE' },
        'customer replied'
      );
      await prisma.automationSequence.updateMany({
        where: { id: seq.id, status: 'SCHEDULED' },
        data: { status: 'REPLIED' },
      });
      console.log(`🛑 Customer replied - stopped "${seq.automation.name}" follow-ups (${cancelled} job)`);
    }
  }

  // ==========================================
  // ✅ HANDLE BUTTON CLICK / RESPONSE
  // ==========================================
  async handleUserResponse(context: {
    organizationId: string;
    contactId: string;
    response: string; // Button ID or message text
    conversationId?: string;
    phone?: string;
  }): Promise<boolean> {
    console.log(`🔘 User response: ${context.response.substring(0, 50)}`);
    let resumed = false;

    try {
      // Ek contact kai automations me ek saath wait kar sakta hai
      const sequences = await prisma.automationSequence.findMany({
        where: {
          contactId: context.contactId,
          status: 'WAITING',
        },
        include: { automation: true },
      });

      if (sequences.length === 0) return false;

      const response = context.response.toLowerCase();

      for (const sequence of sequences) {
        const metadata = (sequence.metadata as any) || {};
        const waitingFor: string[] = metadata.waitingFor || [];

        // Check if response matches
        const matched = waitingFor.length === 0 ||
          waitingFor.some((w) => response.includes(String(w).toLowerCase()));

        if (!matched) {
          console.log(`⏭️ Response doesn't match expected: ${waitingFor}`);
          continue;
        }

        const nextStatus = !sequence.automation.isActive
          ? 'STOPPED'
          : metadata.onReply === 'stop' ? 'REPLIED' : 'ACTIVE';

        // WAITING se ek hi baar palat sakta hai - timeout job aur reply ek
        // saath aa jayein to jo pehle palte, wahi chalega.
        const flipped = await prisma.automationSequence.updateMany({
          where: { id: sequence.id, status: 'WAITING' },
          data: { status: nextStatus },
        });
        if (flipped.count === 0) continue;

        await cancelPendingJobs(
          { contactId: context.contactId, automationId: sequence.automationId, type: 'WAIT_TIMEOUT' },
          'customer replied'
        );

        if (nextStatus !== 'ACTIVE') continue;

        console.log(`🔄 Resuming from step ${sequence.currentStep + 2}`);
        await this.runSteps(
          sequence.automationId,
          sequence.automation.actions as unknown as AutomationAction[],
          sequence.currentStep + 1,
          {
            organizationId: context.organizationId,
            contactId: context.contactId,
            conversationId: context.conversationId,
            phone: context.phone,
          },
          false
        );
        resumed = true;
      }
    } catch (error) {
      console.error('❌ Handle response error:', error);
    }
    return resumed;
  }

  // ==========================================
  // ✅ DURABLE JOBS (follow-up delay, wait timeout)
  // ==========================================
  /** Scheduler har minute bulata hai. Ek tick zyada se zyada ~50 sec. */
  async runDueJobs(): Promise<void> {
    const started = Date.now();
    while (Date.now() - started < 50_000) {
      const jobs = await claimDueJobs(25);
      if (jobs.length === 0) return;
      for (const job of jobs) {
        await this.runJob(job);
      }
    }
  }

  private async runJob(job: ClaimedJob): Promise<void> {
    let resume: { actions: AutomationAction[]; start: number; context: TriggerContext } | null = null;

    try {
      const [automation, sequence, contact] = await Promise.all([
        prisma.automation.findUnique({
          where: { id: job.automationId },
          select: { isActive: true, actions: true },
        }),
        prisma.automationSequence.findUnique({
          where: { automationId_contactId: { automationId: job.automationId, contactId: job.contactId } },
          select: { id: true, status: true, metadata: true },
        }),
        prisma.contact.findUnique({
          where: { id: job.contactId },
          select: { status: true, phone: true },
        }),
      ]);

      if (!automation || !automation.isActive) {
        await finishJob(job.id, 'CANCELLED', 'automation is inactive or deleted');
        return;
      }

      const expected = job.type === 'WAIT_TIMEOUT' ? 'WAITING' : 'SCHEDULED';
      if (!sequence || sequence.status !== expected) {
        await finishJob(job.id, 'CANCELLED', `sequence is ${sequence?.status ?? 'gone'}, not ${expected}`);
        return;
      }

      if (!contact || contact.status !== 'ACTIVE') {
        await this.stopSequence(sequence.id, 'STOPPED');
        await finishJob(job.id, 'CANCELLED', `contact is ${contact?.status ?? 'deleted'}`);
        return;
      }

      const conversation = await prisma.conversation.findFirst({
        where: { organizationId: job.organizationId, contactId: job.contactId, channel: 'WHATSAPP' },
        select: { id: true, automationPaused: true },
      });
      if (conversation?.automationPaused) {
        // Agent ne chat apne haath me le li - bot beech me na bole
        await this.stopSequence(sequence.id, 'STOPPED');
        await finishJob(job.id, 'CANCELLED', 'automation paused on this chat');
        return;
      }

      const settings = await prisma.organizationSettings.findUnique({
        where: { organizationId: job.organizationId },
        select: {
          quietHoursEnabled: true,
          quietHoursStart: true,
          quietHoursEnd: true,
          quietHoursTimezone: true,
        },
      });
      const quietUntil = quietHoursEndsAt(
        new Date(),
        settings && {
          enabled: settings.quietHoursEnabled,
          start: settings.quietHoursStart,
          end: settings.quietHoursEnd,
          timezone: settings.quietHoursTimezone,
        }
      );
      if (quietUntil) {
        await deferJob(job.id, quietUntil, 'quiet hours');
        return;
      }

      if (job.type === 'WAIT_TIMEOUT' && (sequence.metadata as any)?.onTimeout !== 'continue') {
        await this.stopSequence(sequence.id, 'TIMED_OUT');
        await finishJob(job.id, 'DONE', 'no reply - stopped');
        return;
      }

      // Reply aur ye job ek saath aayein to jo pehle palte wahi chalega
      const flipped = await prisma.automationSequence.updateMany({
        where: { id: sequence.id, status: expected },
        data: { status: 'ACTIVE' },
      });
      if (flipped.count === 0) {
        await finishJob(job.id, 'CANCELLED', 'sequence moved on');
        return;
      }

      const actions = automation.actions as unknown as AutomationAction[];
      const byId = job.payload.nextActionId
        ? actions.findIndex((a) => a.id === job.payload.nextActionId)
        : -1;
      const start = byId >= 0 ? byId : Number(job.payload.fromStep) || 0;

      // DONE pehle, steps baad me: at-most-once (automation.jobs.ts dekho)
      await finishJob(job.id, 'DONE');
      resume = {
        actions,
        start,
        context: {
          organizationId: job.organizationId,
          contactId: job.contactId,
          phone: contact.phone,
          conversationId: conversation?.id,
        },
      };
    } catch (error: any) {
      console.error(`❌ [JOB ${job.id}] ${job.type} failed:`, error.message);
      await retryOrFailJob(job, error.message).catch(() => {});
      return;
    }

    if (!resume) return;
    console.log(`⏰ [JOB] Resuming automation ${job.automationId} at step ${resume.start + 1}`);
    await this.runSteps(job.automationId, resume.actions, resume.start, resume.context, false)
      .catch((err: any) => console.error(`❌ [JOB ${job.id}] resume failed:`, err.message));
  }

  private async stopSequence(sequenceId: string, status: string): Promise<void> {
    await prisma.automationSequence.updateMany({
      where: { id: sequenceId, status: { in: ['SCHEDULED', 'WAITING'] } },
      data: { status },
    });
  }

  // ==========================================
  // ✅ TRIGGER: LEAD STAGE CHANGED
  // ==========================================
  /**
   * crm.updateLead aur chatbot ka updateLeadStage dono yahan aate hain.
   * triggerConfig: { pipelineId?, fromStageId?, toStageId? } - jo diya ho wahi milna chahiye.
   */
  async triggerLeadStageChanged(event: {
    organizationId: string;
    leadId: string;
    fromStageId?: string | null;
    toStageId: string;
  }): Promise<void> {
    try {
      const automations = await automationService.getActiveByTrigger(
        event.organizationId, 'LEAD_STAGE_CHANGED'
      );
      if (automations.length === 0) return;

      const lead = await prisma.lead.findFirst({
        where: { id: event.leadId, organizationId: event.organizationId },
        select: { contactId: true, pipelineId: true },
      });
      if (!lead?.contactId) return;

      for (const automation of automations) {
        const cfg = automation.triggerConfig || {};
        if (cfg.pipelineId && cfg.pipelineId !== lead.pipelineId) continue;
        if (cfg.toStageId && cfg.toStageId !== event.toStageId) continue;
        if (cfg.fromStageId && cfg.fromStageId !== event.fromStageId) continue;

        if (automation.targetGroupIds?.length > 0) {
          const inGroup = await this.isContactInTargetGroups(lead.contactId, automation.targetGroupIds);
          if (!inGroup) continue;
        }

        automationLog.info('Lead stage automation triggered', {
          name: automation.name,
          id: automation.id,
        });
        await this.executeSequence(automation.id, automation.actions as any, {
          organizationId: event.organizationId,
          contactId: lead.contactId,
          metadata: {
            leadId: event.leadId,
            fromStageId: event.fromStageId,
            toStageId: event.toStageId,
          },
        });
      }
    } catch (error: any) {
      automationLog.error('Lead stage trigger error', error);
    }
  }

  // ==========================================
  // ✅ TRIGGER: NO REPLY
  // ==========================================
  /**
   * Customer ne baat ki thi, humne jawab diya, aur wo `hours` ghante se chup
   * hai. Sirf wahi chats jahan customer ne kabhi message kiya ho - campaign ke
   * un hazaron logon par nahi chalta jinhone kabhi reply hi nahi kiya.
   * Har chup rehne par ek hi baar: customer ke aakhri message ke baad is
   * automation ka run ho chuka ho to dobara nahi.
   */
  async triggerNoReply(): Promise<void> {
    try {
      const automations = await automationService.getActiveByTrigger(undefined, 'NO_REPLY');
      if (automations.length === 0) return;

      for (const automation of automations) {
        try {
          const hours = Math.max(1, Math.round(Number(automation.triggerConfig?.hours) || 24));

          const rows = await prisma.$queryRaw<Array<{ contactId: string; conversationId: string; phone: string }>>`
            SELECT c."contactId", c."id" AS "conversationId", ct."phone"
              FROM "Conversation" c
              JOIN "Contact" ct ON ct."id" = c."contactId"
             WHERE c."organizationId" = ${automation.organizationId}
               AND c."channel" = 'WHATSAPP'
               AND c."automationPaused" = false
               AND ct."status" = 'ACTIVE'
               AND ct."deletedAt" IS NULL
               AND c."lastCustomerMessageAt" IS NOT NULL
               AND c."lastMessageAt" > c."lastCustomerMessageAt"
               AND c."lastMessageAt" <= now() - (${hours}::int * interval '1 hour')
               AND c."lastMessageAt" >  now() - (${hours}::int * interval '1 hour') - interval '7 days'
               AND NOT EXISTS (
                 SELECT 1 FROM "AutomationSequence" s
                  WHERE s."automationId" = ${automation.id}
                    AND s."contactId" = c."contactId"
                    AND s."lastStepAt" > c."lastCustomerMessageAt"
               )
             ORDER BY c."lastMessageAt" ASC
             LIMIT 100
          `;

          if (rows.length === 0) continue;
          console.log(`🔕 [NO_REPLY] ${automation.name}: ${rows.length} silent chat(s) after ${hours}h`);

          for (const row of rows) {
            try {
              if (automation.targetGroupIds?.length > 0) {
                const inGroup = await this.isContactInTargetGroups(row.contactId, automation.targetGroupIds);
                if (!inGroup) continue;
              }
              await this.executeSequence(automation.id, automation.actions as any, {
                organizationId: automation.organizationId,
                contactId: row.contactId,
                phone: row.phone,
                conversationId: row.conversationId,
              });
              await new Promise((r) => setTimeout(r, 300));
            } catch (err: any) {
              console.error(`❌ [NO_REPLY] Failed for ${row.contactId}:`, err.message);
            }
          }
        } catch (err: any) {
          if (err?.code !== 'P2024') {
            console.error(`❌ [NO_REPLY] Automation ${automation.id} failed:`, err.message);
          }
        }
      }
    } catch (error: any) {
      if (error?.code !== 'P2024') {
        console.error('🤖 No-reply trigger error:', error);
      }
    }
  }

  // ==========================================
  // ✅ TRIGGER: TASK DUE
  // ==========================================
  /**
   * LeadTask ki due date aa gayi: jis agent ko lead mili hai use notification,
   * aur org ki TASK_DUE automations lead ke contact par. reminderSentAt se har
   * task ek hi baar.
   */
  async triggerTasksDue(): Promise<void> {
    const now = new Date();
    const tasks = await prisma.leadTask.findMany({
      where: { isCompleted: false, reminderSentAt: null, dueDate: { lte: now } },
      select: {
        id: true,
        title: true,
        userId: true,
        lead: {
          select: { id: true, title: true, organizationId: true, contactId: true, assignedToId: true },
        },
      },
      orderBy: { dueDate: 'asc' },
      take: 100,
    });
    if (tasks.length === 0) return;

    const automationsByOrg = new Map<string, Awaited<ReturnType<typeof automationService.getActiveByTrigger>>>();

    for (const task of tasks) {
      try {
        const claimed = await prisma.leadTask.updateMany({
          where: { id: task.id, reminderSentAt: null },
          data: { reminderSentAt: now },
        });
        if (claimed.count === 0) continue;

        const { lead } = task;
        const userId =
          lead.assignedToId ||
          task.userId ||
          (await prisma.organization.findUnique({
            where: { id: lead.organizationId },
            select: { ownerId: true },
          }))?.ownerId;

        if (userId) {
          await notificationsService
            .create({
              userId,
              organizationId: lead.organizationId,
              type: 'alert',
              title: '⏰ Follow-up due',
              description: `${task.title} - ${lead.title}`,
              actionUrl: `/(app)/crm/lead/${lead.id}`,
              metadata: {
                leadId: lead.id,
                taskId: task.id,
                webUrl: `/dashboard/crm/leads/${lead.id}`,
              },
            })
            .catch((e: any) => console.error('Task due notification failed:', e?.message));
        }

        if (!lead.contactId) continue;

        let automations = automationsByOrg.get(lead.organizationId);
        if (!automations) {
          automations = await automationService.getActiveByTrigger(lead.organizationId, 'TASK_DUE');
          automationsByOrg.set(lead.organizationId, automations);
        }

        for (const automation of automations) {
          if (automation.targetGroupIds?.length > 0) {
            const inGroup = await this.isContactInTargetGroups(lead.contactId, automation.targetGroupIds);
            if (!inGroup) continue;
          }
          await this.executeSequence(automation.id, automation.actions as any, {
            organizationId: lead.organizationId,
            contactId: lead.contactId,
            metadata: { leadId: lead.id, taskId: task.id },
          });
        }
      } catch (err: any) {
        console.error(`❌ [TASK_DUE] Task ${task.id} failed:`, err.message);
      }
    }
  }

  // ==========================================
  // HELPER METHODS
  // ==========================================
  private async getDefaultAccount(organizationId: string) {
    return prisma.whatsAppAccount.findFirst({
      where: { organizationId, status: 'CONNECTED' },
      orderBy: { isDefault: 'desc' },
    });
  }

  private async isWindowOpenFor(organizationId: string, contactId: string): Promise<boolean> {
    const conversation = await prisma.conversation.findFirst({
      where: { organizationId, contactId, channel: 'WHATSAPP' },
      select: { windowExpiresAt: true, isWindowOpen: true, lastCustomerMessageAt: true },
    });
    return isWindowOpen(conversation);
  }

  private async replaceVariables(text: string, context: TriggerContext): Promise<string> {
    let result = text;

    if (context.contactId) {
      const contact = await prisma.contact.findUnique({
        where: { id: context.contactId },
      });

      if (contact) {
        result = result.replace(/\{\{firstName\}\}/gi, contact.firstName || '');
        result = result.replace(/\{\{lastName\}\}/gi, contact.lastName || '');
        result = result.replace(/\{\{phone\}\}/gi, contact.phone || '');
        result = result.replace(/\{\{name\}\}/gi,
          [contact.firstName, contact.lastName].filter(Boolean).join(' ') || 'there'
        );
      }
    }

    result = result.replace(/\{\{date\}\}/gi, new Date().toLocaleDateString());
    result = result.replace(/\{\{time\}\}/gi, new Date().toLocaleTimeString());

    return result;
  }

  private async actionAddTag(
    context: TriggerContext, 
    config: any
): Promise<void> {
    if (!context.contactId) {
        console.warn('⚠️ [add_tag] No contactId in context');
        return;
    }
    
    // ✅ Both keys support karo - frontend 'tagName' bhejta hai
    const tagValue = config.tag || config.tagName;
    
    if (!tagValue) {
        console.warn('⚠️ [add_tag] No tag value. Config received:', config);
        return;
    }

    await prisma.contact.update({
        where: { id: context.contactId },
        data: { tags: { push: tagValue } },
    });

    console.log(`✅ [add_tag] Tag "${tagValue}" added to contact: ${context.contactId}`);
}

  private async actionCreateLead(context: TriggerContext, config: any): Promise<void> {
    if (!context.contactId) return;

    const existing = await prisma.lead.findFirst({
      where: {
        organizationId: context.organizationId,
        contactId: context.contactId,
        status: { notIn: ['WON', 'LOST'] },
      },
    });

    if (existing) {
      console.log(`⏭️ Lead already exists`);
      return;
    }

    const pipeline = await prisma.pipeline.findFirst({
      where: { organizationId: context.organizationId, isDefault: true },
      include: { stages: { orderBy: { order: 'asc' }, take: 1 } },
    });

    await prisma.lead.create({
      data: {
        organizationId: context.organizationId,
        title: config.title || 'Automated Lead',
        contactId: context.contactId,
        pipelineId: pipeline?.id,
        stageId: pipeline?.stages[0]?.id,
        source: 'automation',
      },
    });

    console.log(`✅ Created lead`);
  }

  /**
   * Client ke apne Razorpay se payment link bana kar customer ko bhejo.
   * config: { amount } (rupees) ya { useLeadValue: true }, aur optional description.
   */
  private async actionSendPaymentLink(context: TriggerContext, config: any): Promise<void> {
    if (!context.contactId) {
      console.warn('⚠️ [send_payment_link] No contactId in context');
      return;
    }

    let amount = Number(config?.amount);

    if (config?.useLeadValue || !Number.isFinite(amount) || amount <= 0) {
      const lead = await prisma.lead.findFirst({
        where: {
          organizationId: context.organizationId,
          contactId: context.contactId,
          status: { notIn: ['WON', 'LOST'] },
        },
        orderBy: { createdAt: 'desc' },
        select: { value: true },
      });
      if (lead?.value) amount = Number(lead.value);
    }

    if (!Number.isFinite(amount) || amount <= 0) {
      console.warn('⚠️ [send_payment_link] No amount (set one, or put a value on the lead)');
      return;
    }

    const { paymentsService } = await import('../payments/payments.service');
    const { sent } = await paymentsService.createPaymentLink({
      organizationId: context.organizationId,
      amountPaise: Math.round(amount * 100),
      description: config?.description,
      contactId: context.contactId,
      conversationId: context.conversationId,
      createdVia: 'automation',
      sendOnWhatsApp: true,
    });

    console.log(`💳 [send_payment_link] ₹${amount} link created${sent ? ' and sent' : ' (not sent - window closed?)'}`);
  }

  // ==========================================
  // ✅ TRIGGER: PAYMENT RECEIVED
  // ==========================================
  /**
   * Customer ka payment aaya (client ke Razorpay par). payments.service isse
   * bulata hai - lead Won hone aur receipt jane ke baad.
   * triggerConfig: { minAmount } rupees me - chhote payments par na chale.
   */
  async triggerPaymentReceived(event: {
    organizationId: string;
    paymentId: string;
    leadId?: string | null;
    contactId?: string | null;
    conversationId?: string | null;
    amountPaise: number;
  }): Promise<void> {
    try {
      if (!event.contactId) return;

      const automations = await automationService.getActiveByTrigger(
        event.organizationId, 'PAYMENT_RECEIVED'
      );
      if (automations.length === 0) return;

      for (const automation of automations) {
        const minAmount = Number((automation.triggerConfig as any)?.minAmount);
        if (Number.isFinite(minAmount) && minAmount > 0 && event.amountPaise < minAmount * 100) continue;

        if (automation.targetGroupIds?.length > 0) {
          const inGroup = await this.isContactInTargetGroups(event.contactId, automation.targetGroupIds);
          if (!inGroup) continue;
        }

        automationLog.info('Payment received automation triggered', {
          name: automation.name,
          id: automation.id,
        });
        await this.executeSequence(automation.id, automation.actions as any, {
          organizationId: event.organizationId,
          contactId: event.contactId,
          conversationId: event.conversationId || undefined,
          metadata: {
            paymentId: event.paymentId,
            leadId: event.leadId,
            amountPaise: event.amountPaise,
          },
        });
      }
    } catch (error: any) {
      automationLog.error('Payment received trigger error', error);
    }
  }

  // Existing execute actions (keep for backward compatibility)
  async executeActions(
    automationId: string,
    actions: AutomationAction[],
    context: TriggerContext
  ): Promise<void> {
    await this.executeSequence(automationId, actions, context);
  }
}

export const automationEngine = new AutomationEngine();
export default automationEngine;
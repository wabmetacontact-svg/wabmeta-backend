// ✅ CREATE: src/modules/automation/automation.engine.ts

import prisma from '../../config/database';
import { whatsappService } from '../whatsapp/whatsapp.service';
import { automationService } from './automation.service';
import { crmService } from '../crm/crm.service';
import { AutomationTrigger } from '@prisma/client';

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
  // ✅ NEW: TRIGGER UNKNOWN MESSAGE
  // ==========================================
  async triggerUnknownMessage(context: TriggerContext): Promise<void> {
    console.log(`🤖 [AUTOMATION] Triggering UNKNOWN_MESSAGE for org: ${context.organizationId}`);

    try {
      // ✅ 1. Check if contact exists in CRM
      const contactExists = await prisma.contact.findFirst({
        where: {
          organizationId: context.organizationId,
          phone: context.phone,
        },
      });

      if (contactExists) {
        console.log(`⏭️ Contact already exists. Skipping automation.`);
        return;
      }

      // ✅ 2. Find active UNKNOWN_MESSAGE automations
      const automations = await automationService.getActiveByTrigger(
        context.organizationId,
        'UNKNOWN_MESSAGE'
      );

      if (automations.length === 0) {
        console.log(`ℹ️ No active UNKNOWN_MESSAGE automations found`);
        return;
      }

      // ✅ 3. Create contact first
      const newContact = await prisma.contact.create({
        data: {
          organizationId: context.organizationId,
          phone: context.phone!,
          countryCode: '+91',
          firstName: 'Unknown',
          status: 'ACTIVE',
          source: 'WHATSAPP_AUTOMATION',
        },
      });

      console.log(`👤 Created new contact: ${newContact.id}`);

      // ✅ 4. Execute automation sequence
      for (const automation of automations) {
        console.log(`🤖 Executing automation: ${automation.name}`);
        
        // Create sequence tracker
        await prisma.automationSequence.create({
          data: {
            automationId: automation.id,
            contactId: newContact.id,
            currentStep: 0,
            status: 'ACTIVE',
          },
        });

        // Start execution
        await this.executeSequence(
          automation.id,
          automation.actions as any,
          {
            ...context,
            contactId: newContact.id,
          }
        );
      }
    } catch (error) {
      console.error('🤖 UNKNOWN_MESSAGE automation error:', error);
    }
  }

  // ==========================================
  // ✅ NEW: EXECUTE SEQUENCE (MULTI-STEP)
  // ==========================================
  private async executeSequence(
    automationId: string,
    actions: AutomationAction[],
    context: TriggerContext
  ): Promise<void> {
    console.log(`🔄 Executing sequence: ${actions.length} steps`);

    for (let i = 0; i < actions.length; i++) {
      const action = actions[i];
      
      try {
        console.log(`🤖 Step ${i + 1}: ${action.type}`);

        // Update sequence progress
        await prisma.automationSequence.updateMany({
          where: {
            automationId,
            contactId: context.contactId!,
          },
          data: {
            currentStep: i,
            lastStepAt: new Date(),
          },
        });

        // Execute action
        switch (action.type) {
          case 'send_message':
          case 'send_text':
            await this.actionSendText(context, action.config);
            break;

          case 'send_audio':
            await this.actionSendAudio(context, action.config);
            break;

          case 'send_video':
            await this.actionSendVideo(context, action.config);
            break;

          case 'send_buttons':
            await this.actionSendButtons(context, action.config);
            break;

          case 'wait_for_response':
            await this.actionWaitForResponse(automationId, context, action.config);
            return; // ✅ Pause sequence until button click

          case 'delay':
            await this.actionDelay(action.config);
            break;

          case 'send_template':
            await this.actionSendTemplate(context, action.config);
            break;

          case 'add_tag':
            await this.actionAddTag(context, action.config);
            break;

          case 'remove_tag':
            await this.actionRemoveTag(context, action.config);
            break;

          case 'create_lead':
            await this.actionCreateLead(context, action.config);
            break;

          case 'webhook':
            await this.actionCallWebhook(context, action.config);
            break;

          default:
            console.warn(`⚠️ Unknown action type: ${action.type}`);
        }
      } catch (error: any) {
        console.error(`❌ Step ${i + 1} failed:`, error.message);
      }
    }

    // ✅ Mark sequence as completed
    await prisma.automationSequence.updateMany({
      where: {
        automationId,
        contactId: context.contactId!,
      },
      data: {
        status: 'COMPLETED',
      },
    });

    await automationService.incrementExecutionCount(automationId);
  }

  // ==========================================
  // ✅ NEW ACTIONS
  // ==========================================

  private async actionSendText(context: TriggerContext, config: any): Promise<void> {
    const phone = context.phone || (context.contactId ? (await prisma.contact.findUnique({ where: { id: context.contactId } }))?.phone : null);
    if (!phone) {
      console.warn('⚠️ No phone number');
      return;
    }

    const account = await this.getDefaultAccount(context.organizationId);
    if (!account) return;

    const message = await this.replaceVariables(config.text || config.message || '', context);

    await whatsappService.sendTextMessage(
      account.id,
      phone,
      message,
      context.conversationId,
      context.organizationId
    );

    console.log(`✅ Sent text message to ${phone}`);
  }

  private async actionSendAudio(context: TriggerContext, config: any): Promise<void> {
    const phone = context.phone || (context.contactId ? (await prisma.contact.findUnique({ where: { id: context.contactId } }))?.phone : null);
    if (!phone || !config.audioUrl) {
      console.warn('⚠️ Missing phone or audio URL');
      return;
    }

    const account = await this.getDefaultAccount(context.organizationId);
    if (!account) return;

    await whatsappService.sendMediaMessage(
      account.id,
      phone,
      'audio',
      config.audioUrl,
      undefined,
      context.conversationId,
      context.organizationId
    );

    console.log(`✅ Sent audio to ${phone}`);
  }

  private async actionSendVideo(context: TriggerContext, config: any): Promise<void> {
    const phone = context.phone || (context.contactId ? (await prisma.contact.findUnique({ where: { id: context.contactId } }))?.phone : null);
    if (!phone || !config.videoUrl) {
      console.warn('⚠️ Missing phone or video URL');
      return;
    }

    const account = await this.getDefaultAccount(context.organizationId);
    if (!account) return;

    await whatsappService.sendMediaMessage(
      account.id,
      phone,
      'video',
      config.videoUrl,
      config.caption,
      context.conversationId,
      context.organizationId
    );

    console.log(`✅ Sent video to ${phone}`);
  }

  private async actionSendButtons(context: TriggerContext, config: any): Promise<void> {
    const phone = context.phone || (context.contactId ? (await prisma.contact.findUnique({ where: { id: context.contactId } }))?.phone : null);
    if (!phone || !config.buttons) {
      console.warn('⚠️ Missing phone or buttons');
      return;
    }

    const account = await this.getDefaultAccount(context.organizationId);
    if (!account) return;

    // ✅ Send Interactive Message with Buttons
    const interactivePayload = {
      type: 'button',
      body: {
        text: config.text || config.message || 'Please select an option:',
      },
      action: {
        buttons: config.buttons.map((btn: any, index: number) => ({
          type: 'reply',
          reply: {
            id: btn.id || `btn_${index}`,
            title: btn.text,
          },
        })),
      },
    };

    await (whatsappService as any).sendMessage({
      accountId: account.id,
      to: phone,
      type: 'interactive',
      content: { interactive: interactivePayload },
      conversationId: context.conversationId,
      organizationId: context.organizationId,
    });

    console.log(`✅ Sent buttons to ${phone}`);
  }

  private async actionWaitForResponse(
    automationId: string,
    context: TriggerContext,
    config: any
  ): Promise<void> {
    console.log(`⏸️ Waiting for user response...`);

    // ✅ Update sequence status to WAITING
    await prisma.automationSequence.updateMany({
      where: {
        automationId,
        contactId: context.contactId!,
      },
      data: {
        status: 'WAITING',
        metadata: config || {}, // Store button IDs to match
      },
    });
  }

  // ==========================================
  // ✅ HANDLE BUTTON CLICK
  // ==========================================
  async handleButtonClick(context: {
    organizationId: string;
    contactId: string;
    buttonId: string;
    conversationId?: string;
  }): Promise<void> {
    console.log(`🔘 Button clicked: ${context.buttonId}`);

    try {
      // ✅ Find waiting sequence
      const sequence = await prisma.automationSequence.findFirst({
        where: {
          contactId: context.contactId,
          status: 'WAITING',
        },
        include: {
          automation: true,
        },
      });

      if (!sequence) {
        console.log(`ℹ️ No waiting sequence found`);
        return;
      }

      // ✅ Resume sequence from next step
      const remainingActions = (sequence.automation.actions as any[]).slice(
        sequence.currentStep + 1
      );

      if (remainingActions.length > 0) {
        console.log(`🔄 Resuming sequence from step ${sequence.currentStep + 1}`);

        await prisma.automationSequence.update({
          where: { id: sequence.id },
          data: { status: 'ACTIVE' },
        });

        await this.executeSequence(sequence.automationId, remainingActions, {
          organizationId: context.organizationId,
          contactId: context.contactId,
          conversationId: context.conversationId,
        });
      }
    } catch (error) {
      console.error('❌ Button click handling error:', error);
    }
  }

  // ==========================================
  // EXISTING TRIGGERS
  // ==========================================
  async triggerNewContact(context: TriggerContext): Promise<void> {
    console.log(`🤖 [AUTOMATION] Triggering NEW_CONTACT for org: ${context.organizationId}`);

    try {
      const automations = await automationService.getActiveByTrigger(
        context.organizationId,
        'NEW_CONTACT'
      );

      for (const automation of automations) {
        console.log(`🤖 Executing automation: ${automation.name}`);
        
        // Create sequence tracker
        await prisma.automationSequence.upsert({
          where: { 
            automationId_contactId: {
                automationId: automation.id,
                contactId: context.contactId!
            }
          },
          update: {
            currentStep: 0,
            status: 'ACTIVE'
          },
          create: {
            automationId: automation.id,
            contactId: context.contactId!,
            currentStep: 0,
            status: 'ACTIVE',
          },
        });

        await this.executeSequence(automation.id, automation.actions as any, context);
      }
    } catch (error) {
      console.error('🤖 NEW_CONTACT automation error:', error);
    }
  }

  async triggerKeyword(context: TriggerContext): Promise<boolean> {
    if (!context.message) return false;

    console.log(`🤖 [AUTOMATION] Checking KEYWORD triggers for: "${context.message}"`);

    try {
      const automations = await automationService.getActiveByTrigger(
        context.organizationId,
        'KEYWORD'
      );

      let triggered = false;

      for (const automation of automations) {
        const keywords: string[] = (automation.triggerConfig as any)?.keywords || [];
        const exactMatch = (automation.triggerConfig as any)?.exactMatch || false;

        const messageL = context.message.toLowerCase().trim();

        const matched = keywords.some((keyword) => {
          const keywordL = keyword.toLowerCase().trim();
          if (exactMatch) {
            return messageL === keywordL;
          }
          return messageL.includes(keywordL);
        });

        if (matched) {
          console.log(`🤖 Keyword matched! Executing automation: ${automation.name}`);
          
          await prisma.automationSequence.upsert({
            where: { 
              automationId_contactId: {
                  automationId: automation.id,
                  contactId: context.contactId!
              }
            },
            update: {
              currentStep: 0,
              status: 'ACTIVE'
            },
            create: {
              automationId: automation.id,
              contactId: context.contactId!,
              currentStep: 0,
              status: 'ACTIVE',
            },
          });

          await this.executeSequence(automation.id, automation.actions as any, context);
          triggered = true;
        }
      }

      return triggered;
    } catch (error) {
      console.error('🤖 KEYWORD automation error:', error);
      return false;
    }
  }

  // ==========================================
  // HELPER: Get Default WhatsApp Account
  // ==========================================
  private async getDefaultAccount(organizationId: string) {
    const account = await prisma.whatsAppAccount.findFirst({
      where: {
        organizationId,
        status: 'CONNECTED',
      },
      orderBy: { isDefault: 'desc' },
    });

    if (!account) {
      console.warn('⚠️ No WhatsApp account connected');
    }

    return account;
  }

  // ==========================================
  // ACTIONS (Legacy / Individual)
  // ==========================================
  private async actionSendTemplate(context: TriggerContext, config: any): Promise<void> {
      const phone = context.phone || (context.contactId ? (await prisma.contact.findUnique({ where: { id: context.contactId } }))?.phone : null);
      if (!phone || !config.templateId) return;

      const template = await prisma.template.findUnique({ where: { id: config.templateId } });
      if (!template || template.status !== 'APPROVED') return;

      const account = await this.getDefaultAccount(context.organizationId);
      if (!account) return;

      await whatsappService.sendTemplateMessage({
          accountId: account.id,
          to: phone,
          templateName: template.name,
          templateLanguage: template.language,
          conversationId: context.conversationId,
          organizationId: context.organizationId,
      });
  }

  private async actionAddTag(context: TriggerContext, config: any): Promise<void> {
      if (!context.contactId || !config.tag) return;
      await prisma.contact.update({
          where: { id: context.contactId },
          data: { tags: { push: config.tag } }
      });
  }

  private async actionRemoveTag(context: TriggerContext, config: any): Promise<void> {
      if (!context.contactId || !config.tag) return;
      const contact = await prisma.contact.findUnique({ where: { id: context.contactId } });
      if (!contact) return;
      const newTags = (contact.tags || []).filter(t => t !== config.tag);
      await prisma.contact.update({ where: { id: context.contactId }, data: { tags: newTags } });
  }

  private async actionCreateLead(context: TriggerContext, config: any): Promise<void> {
      if (!context.contactId) return;
      await crmService.createLead(context.organizationId, 'automation', {
          title: config.title || 'Automated Lead',
          contactId: context.contactId,
          source: 'automation',
      });
  }

  private async actionCallWebhook(context: TriggerContext, config: any): Promise<void> {
      if (!config.url) return;
      try {
          const contact = context.contactId ? await prisma.contact.findUnique({ where: { id: context.contactId } }) : null;
          await fetch(config.url, {
              method: config.method || 'POST',
              headers: { 'Content-Type': 'application/json', ...(config.headers || {}) },
              body: JSON.stringify({
                  event: 'automation_trigger',
                  organizationId: context.organizationId,
                  contact,
                  message: context.message,
                  timestamp: new Date().toISOString()
              })
          });
      } catch (e: any) { console.error('Webhook action error:', e.message); }
  }

  private async actionDelay(config: any): Promise<void> {
      const ms = (config.duration || 1) * (config.unit === 'minutes' ? 60000 : config.unit === 'hours' ? 3600000 : 1000);
      await new Promise(resolve => setTimeout(resolve, ms));
  }

  private async replaceVariables(text: string, context: TriggerContext): Promise<string> {
      let result = text;
      if (context.contactId) {
          const contact = await prisma.contact.findUnique({ where: { id: context.contactId } });
          if (contact) {
              result = result.replace(/\{\{firstName\}\}/gi, contact.firstName || '')
                            .replace(/\{\{lastName\}\}/gi, contact.lastName || '')
                            .replace(/\{\{phone\}\}/gi, contact.phone || '')
                            .replace(/\{\{email\}\}/gi, contact.email || '');
          }
      }
      return result.replace(/\{\{date\}\}/gi, new Date().toLocaleDateString())
                   .replace(/\{\{time\}\}/gi, new Date().toLocaleTimeString());
  }
}

export const automationEngine = new AutomationEngine();
export default automationEngine;
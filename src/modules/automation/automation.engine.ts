import prisma from '../../config/database';
import { whatsappService } from '../whatsapp/whatsapp.service';
import { automationService } from './automation.service';
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
  // ✅ CHECK IF CONTACT EXISTS (For UNKNOWN_MESSAGE)
  // ==========================================
  private async contactExistsInCRM(
    organizationId: string,
    phone: string
  ): Promise<boolean> {
    const contact = await prisma.contact.findFirst({
      where: {
        organizationId,
        phone: phone,
        createdAt: {
          lt: new Date(Date.now() - 60000), // Older than 1 minute
        },
      },
    });
    return !!contact;
  }

  // ==========================================
  // ✅ TRIGGER: UNKNOWN MESSAGE (Enhanced)
  // ==========================================
  async triggerUnknownMessage(context: TriggerContext): Promise<void> {
    console.log(`🤖 [AUTOMATION] Triggering UNKNOWN_MESSAGE for org: ${context.organizationId}`);

    try {
      // Get automations
      const automations = await automationService.getActiveByTrigger(
        context.organizationId,
        'UNKNOWN_MESSAGE'
      );

      if (automations.length === 0) {
        console.log(`ℹ️ No active UNKNOWN_MESSAGE automations found`);
        return;
      }

      for (const automation of automations) {
        // ✅ Check excludeExisting flag
        if (automation.excludeExisting) {
          const exists = await this.contactExistsInCRM(
            context.organizationId,
            context.phone!
          );
          if (exists) {
            console.log(`⏭️ Contact already exists. Skipping automation: ${automation.name}`);
            continue;
          }
        }

        // ✅ Check target groups (if contact already exists)
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
        await this.executeSequence(automation.id, automation.actions, context);
      }
    } catch (error) {
      console.error('🤖 UNKNOWN_MESSAGE automation error:', error);
    }
  }

  // ==========================================
  // ✅ TRIGGER: KEYWORD (Enhanced with Groups)
  // ==========================================
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
        // ✅ Check target groups first
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
          await this.executeActions(automation.id, automation.actions, context);
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
  // ✅ TRIGGER: NEW CONTACT (Enhanced with Groups)
  // ==========================================
  async triggerNewContact(context: TriggerContext): Promise<void> {
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
        await this.executeActions(automation.id, automation.actions, context);
      }
    } catch (error) {
      console.error('🤖 NEW_CONTACT automation error:', error);
    }
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

      await this.executeActions(automation.id, automation.actions as any, context);
    } catch (error) {
      console.error('🤖 Webhook automation error:', error);
    }
  }

  // ==========================================
  // ✅ TRIGGER: Scheduled
  // ==========================================
  async triggerScheduled(): Promise<void> {
    // This typically finds all active SCHEDULED automations across all organizations
    try {
      const automations = await automationService.getActiveByTrigger(undefined as any, 'SCHEDULE_TIME' as any);
      
      for (const automation of automations) {
        console.log(`⏰ Processing scheduled automation: ${automation.id}`);
        // Logic to find eligible contacts for this scheduled automation...
      }
    } catch (error) {
      console.error('🤖 Scheduled automation trigger error:', error);
    }
  }

  // ==========================================
  // ✅ TRIGGER: Inactivity
  // ==========================================
  async triggerInactivity(): Promise<void> {
    // This finds contacts inactive for specified duration
    try {
      const automations = await automationService.getActiveByTrigger(undefined as any, 'INACTIVITY');
      
      for (const automation of automations) {
        console.log(`💤 Checking inactivity automation: ${automation.id}`);
        // Logic to scan contacts for inactivity period...
      }
    } catch (error) {
      console.error('🤖 Inactivity automation trigger error:', error);
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
  }): Promise<void> {
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
  private async executeSequence(
    automationId: string,
    actions: AutomationAction[],
    context: TriggerContext
  ): Promise<void> {
    console.log(`🔄 Executing sequence: ${actions.length} steps`);

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

    // Create sequence tracker
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

    // Execute actions
    for (let i = 0; i < actions.length; i++) {
      const action = actions[i];

      try {
        console.log(`🤖 Step ${i + 1}: ${action.type}`);

        // Update progress
        await prisma.automationSequence.updateMany({
          where: { automationId, contactId },
          data: { currentStep: i, lastStepAt: new Date() },
        });

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
            await this.actionSendTemplate({ ...context, contactId }, action.config);
            break;

          case 'wait_for_response':
            await this.actionWaitForResponse(automationId, contactId, action.config);
            return; // Pause until user responds

          case 'delay':
            await this.actionDelay(action.config);
            break;

          case 'add_tag':
            await this.actionAddTag({ ...context, contactId }, action.config);
            break;

          case 'add_to_group':
            await this.actionAddToGroup({ ...context, contactId }, action.config);
            break;

          case 'create_lead':
            await this.actionCreateLead({ ...context, contactId }, action.config);
            break;

          default:
            console.warn(`⚠️ Unknown action: ${action.type}`);
        }
      } catch (error: any) {
        console.error(`❌ Step ${i + 1} failed:`, error.message);
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
  private async actionSendTemplate(context: TriggerContext, config: any): Promise<void> {
    const account = await this.getDefaultAccount(context.organizationId);
    if (!account || !context.phone || !config.templateId) return;

    const template = await prisma.template.findUnique({
      where: { id: config.templateId },
    });

    if (!template || template.status !== 'APPROVED') {
      console.warn('⚠️ Template not found or not approved');
      return;
    }

    await whatsappService.sendTemplateMessage({
      accountId: account.id,
      to: context.phone,
      templateName: template.name,
      templateLanguage: template.language,
      components: config.components || [],
      conversationId: context.conversationId,
      organizationId: context.organizationId,
    });

    console.log(`✅ Sent template ${template.name} to ${context.phone}`);
  }

  // ==========================================
  // ✅ ACTION: WAIT FOR RESPONSE
  // ==========================================
  private async actionWaitForResponse(
    automationId: string,
    contactId: string,
    config: any
  ): Promise<void> {
    console.log(`⏸️ Pausing sequence until user responds`);

    await prisma.automationSequence.updateMany({
      where: { automationId, contactId },
      data: {
        status: 'WAITING',
        metadata: {
          waitingFor: config.buttonIds || config.keywords || [],
          timeout: config.timeout || 24 * 60 * 60 * 1000, // 24 hours default
        },
      },
    });
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
  // ✅ HANDLE BUTTON CLICK / RESPONSE
  // ==========================================
  async handleUserResponse(context: {
    organizationId: string;
    contactId: string;
    response: string; // Button ID or message text
    conversationId?: string;
    phone?: string;
  }): Promise<void> {
    console.log(`🔘 User response: ${context.response}`);

    try {
      // Find waiting sequence
      const sequence = await prisma.automationSequence.findFirst({
        where: {
          contactId: context.contactId,
          status: 'WAITING',
        },
        include: { automation: true },
      });

      if (!sequence) {
        console.log(`ℹ️ No waiting sequence found`);
        return;
      }

      const metadata = sequence.metadata as any;
      const waitingFor = metadata?.waitingFor || [];

      // Check if response matches
      const matched = waitingFor.length === 0 || 
        waitingFor.some((w: string) => 
          context.response.toLowerCase().includes(w.toLowerCase())
        );

      if (!matched) {
        console.log(`⏭️ Response doesn't match expected: ${waitingFor}`);
        return;
      }

      // Resume sequence
      const remainingActions = (sequence.automation.actions as any[]).slice(
        sequence.currentStep + 1
      );

      if (remainingActions.length > 0) {
        console.log(`🔄 Resuming from step ${sequence.currentStep + 1}`);

        await prisma.automationSequence.update({
          where: { id: sequence.id },
          data: { status: 'ACTIVE' },
        });

        await this.executeSequence(sequence.automationId, remainingActions, {
          organizationId: context.organizationId,
          contactId: context.contactId,
          conversationId: context.conversationId,
          phone: context.phone,
        });
      }
    } catch (error) {
      console.error('❌ Handle response error:', error);
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

  private async actionDelay(config: any): Promise<void> {
    const duration = config.duration || 1;
    const unit = config.unit || 'seconds';

    let ms = duration * 1000;
    if (unit === 'minutes') ms = duration * 60 * 1000;
    if (unit === 'hours') ms = duration * 60 * 60 * 1000;

    console.log(`⏳ Waiting ${duration} ${unit}...`);
    await new Promise((resolve) => setTimeout(resolve, ms));
  }

  private async actionAddTag(context: TriggerContext, config: any): Promise<void> {
    if (!context.contactId || !config.tag) return;

    await prisma.contact.update({
      where: { id: context.contactId },
      data: { tags: { push: config.tag } },
    });

    console.log(`✅ Added tag: ${config.tag}`);
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
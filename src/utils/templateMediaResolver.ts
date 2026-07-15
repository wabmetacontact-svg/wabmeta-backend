// src/utils/templateMediaResolver.ts - FINAL VERSION
// ✅ Meta stores approved template media permanently
// ✅ No media validation needed at send time
// ✅ Just check template status and account connection

import prisma from '../config/database';

/**
 * ✅ Validate template is ready to send
 * No media checks needed - Meta handles media for approved templates
 */
export async function validateTemplateReady(templateId: string): Promise<{
  ready: boolean;
  reason?: string;
}> {
  const template = await prisma.template.findUnique({
    where: { id: templateId },
    include: { whatsappAccount: true },
  });

  if (!template) {
    return { ready: false, reason: 'Template not found' };
  }

  if (template.status !== 'APPROVED') {
    return { 
      ready: false, 
      reason: `Template "${template.name}" is not approved (status: ${template.status}). Please wait for Meta approval or fix rejection issues.` 
    };
  }

  if (!template.whatsappAccount) {
    return { 
      ready: false, 
      reason: 'No WhatsApp account linked to this template' 
    };
  }

  if (template.whatsappAccount.status !== 'CONNECTED') {
    return { 
      ready: false, 
      reason: 'WhatsApp account is disconnected. Please reconnect in Settings.' 
    };
  }

  // ✅ NO MEDIA CHECK NEEDED
  // Meta permanently stores approved template media.
  // When we send by template name, Meta auto-attaches the media.

  console.log(`✅ Template "${template.name}" is ready to send`);
  return { ready: true };
}

// ============================================
// DEPRECATED - Kept for backward compatibility
// These functions are no longer needed but kept
// to prevent breaking imports in other files
// ============================================

export async function getTemplateMediaUrl(
  templateId: string
): Promise<{ url: string | null; type: string | null }> {
  // Not needed anymore - Meta handles media
  const template = await prisma.template.findUnique({
    where: { id: templateId },
    select: { headerType: true, headerContent: true },
  });

  return { 
    url: template?.headerContent || null, 
    type: template?.headerType || null 
  };
}

export async function getFreshMediaIdForSending(
  templateId: string
): Promise<string | null> {
  // Not needed - Meta uses stored media automatically
  return null;
}

export async function resolveTemplateHeaderMedia(template: {
  id: string;
  organizationId: string;
  headerType: string | null;
  headerContent: string | null;
}): Promise<string | null> {
  // Not needed - Meta handles media for approved templates
  return template.headerContent;
}

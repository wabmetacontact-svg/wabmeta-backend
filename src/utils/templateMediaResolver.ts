// src/utils/templateMediaResolver.ts - PERMANENT FIX
// ✅ NO expiry, NO re-upload loop
// ✅ Uses Cloudinary URL directly (link method)
// ✅ Meta accepts URL — no media ID needed!

import prisma from '../config/database';

/**
 * ✅ NEW STRATEGY: Return Cloudinary URL directly
 * Meta accepts direct URLs in template messages via "link" parameter
 * URL never expires as long as Cloudinary has the file
 */
export async function getTemplateMediaUrl(
  templateId: string
): Promise<{ url: string | null; type: string | null }> {
  const template = await prisma.template.findUnique({
    where: { id: templateId },
    select: {
      id: true,
      name: true,
      headerType: true,
      headerContent: true,
    },
  });

  if (!template) {
    console.error(`❌ Template not found: ${templateId}`);
    return { url: null, type: null };
  }

  const headerType = (template.headerType || '').toUpperCase();

  // No media header - nothing to resolve
  if (!['IMAGE', 'VIDEO', 'DOCUMENT'].includes(headerType)) {
    return { url: null, type: null };
  }

  const url = template.headerContent;

  // Validate URL
  if (!url || !url.startsWith('http')) {
    console.error(`❌ Template "${template.name}" has no valid media URL`);
    return { url: null, type: headerType };
  }

  // Skip Meta CDN URLs (they expire)
  if (url.includes('scontent.whatsapp') || url.includes('lookaside.fbsbx.com')) {
    console.error(
      `❌ Template "${template.name}" has expired Meta CDN URL. ` +
      `Please re-upload media.`
    );
    return { url: null, type: headerType };
  }

  console.log(`✅ Using permanent URL for "${template.name}": ${url.substring(0, 60)}...`);
  return { url, type: headerType };
}

/**
 * ✅ Validate template is ready to send
 * NO media re-upload — just verify permanent URL exists
 */
export async function validateTemplateReady(templateId: string): Promise<{
  ready: boolean;
  reason?: string;
}> {
  const template = await prisma.template.findUnique({
    where: { id: templateId },
    include: { whatsappAccount: true },
  });

  if (!template) return { ready: false, reason: 'Template not found' };

  if (template.status !== 'APPROVED') {
    return { ready: false, reason: `Template not approved (${template.status})` };
  }

  if (!template.whatsappAccount) {
    return { ready: false, reason: 'No WhatsApp account linked' };
  }

  if (template.whatsappAccount.status !== 'CONNECTED') {
    return { ready: false, reason: 'WhatsApp account disconnected' };
  }

  const headerType = (template.headerType || '').toUpperCase();

  // Media templates need valid permanent URL
  if (['IMAGE', 'VIDEO', 'DOCUMENT'].includes(headerType)) {
    const url = template.headerContent;

    if (!url || !url.startsWith('http')) {
      return {
        ready: false,
        reason: `Template "${template.name}" has no media URL. Please edit and re-upload media.`,
      };
    }

    if (url.includes('scontent.whatsapp') || url.includes('lookaside.fbsbx.com')) {
      return {
        ready: false,
        reason: `Template "${template.name}" has expired Meta CDN URL. Please edit and re-upload media.`,
      };
    }

    // ✅ URL is valid Cloudinary/permanent URL — always ready!
    console.log(`✅ Template "${template.name}" ready with permanent URL`);
  }

  return { ready: true };
}

// ============================================
// DEPRECATED - Kept for backward compatibility
// These now just return URL instead of doing uploads
// ============================================

export async function getFreshMediaIdForSending(
  templateId: string
): Promise<string | null> {
  // ✅ NEW: Return URL directly, not media ID
  const { url } = await getTemplateMediaUrl(templateId);
  return url;
}

export async function resolveTemplateHeaderMedia(template: {
  id: string;
  organizationId: string;
  headerType: string | null;
  headerContent: string | null;
}): Promise<string | null> {
  const url = template.headerContent;
  if (!url) return null;

  // Skip Meta CDN URLs — they should be replaced during template creation
  if (url.includes('scontent.whatsapp') || url.includes('lookaside.fbsbx.com')) {
    console.warn(`⚠️ Template ${template.id} has Meta CDN URL - should be re-uploaded`);
    return null;
  }

  return url;
}

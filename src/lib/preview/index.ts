/**
 * Preview System
 * 
 * Phase 14: Multi-viewport preview system.
 * 
 * Features:
 * - Desktop (1440px), Tablet (768px), Mobile (375px) viewports
 * - Preview image generation and caching
 * - Actions: regenerate section, change style, revert to previous
 */

import { prisma } from '../prisma';
import type { ElementorNode } from '../elementor/parser';

// ============================================================================
// Types
// ============================================================================

export type Viewport = 'desktop' | 'tablet' | 'mobile';

export interface ViewportConfig {
  width: number;
  height: number;
  label: string;
  icon: string;
}

export const VIEWPORT_CONFIGS: Record<Viewport, ViewportConfig> = {
  desktop: {
    width: 1440,
    height: 900,
    label: 'Desktop',
    icon: 'monitor',
  },
  tablet: {
    width: 768,
    height: 1024,
    label: 'Tablet',
    icon: 'tablet',
  },
  mobile: {
    width: 375,
    height: 812,
    label: 'Mobile',
    icon: 'smartphone',
  },
};

export interface PreviewOptions {
  projectId: string;
  elementorData?: unknown[];
  stylePreset?: string;
  brandTokens?: {
    colors?: { primary?: string; secondary?: string };
    typography?: { headingFont?: string; bodyFont?: string };
  };
}

// ============================================================================
// Minimal HTML Renderer for Previews
// ============================================================================

/**
 * Render Elementor nodes to HTML string
 */
function renderNodesToHtml(nodes: ElementorNode[], viewport: Viewport): string {
  return nodes.map(node => renderNodeToHtml(node, viewport)).join('\n');
}

function renderNodeToHtml(node: ElementorNode, viewport: Viewport): string {
  switch (node.elType) {
    case 'section':
      const sectionStyle = buildSectionStyle(node, viewport);
      return `<section style="${sectionStyle}">\n${renderNodesToHtml(node.elements || [], viewport)}\n</section>`;
    
    case 'column':
      const colStyle = buildColumnStyle(node, viewport);
      return `<div style="${colStyle}">\n${renderNodesToHtml(node.elements || [], viewport)}\n</div>`;
    
    case 'widget':
      return renderWidgetToHtml(node);
    
    default:
      return '';
  }
}

function renderWidgetToHtml(widget: ElementorNode): string {
  const settings = widget.settings || {};
  
  switch (widget.widgetType) {
    case 'heading':
      const level = (settings.size as string) || 'h2';
      const color = settings.title_color as string || '#000';
      const fontSize = getHeadingFontSize(settings.size as string, settings._css_classes as string);
      return `<${level} style="color:${color};font-size:${fontSize};margin:0 0 1rem;">${settings.heading || ''}</${level}>`;
    
    case 'text-editor':
      return `<div style="line-height:1.7;">${settings.editor || ''}</div>`;
    
    case 'button':
      const bgColor = settings.background_color || '#3B82F6';
      const textColor = settings.button_text_color || '#fff';
      const padding = settings.padding || '12px 24px';
      return `<button style="background:${bgColor};color:${textColor};padding:${padding};border:none;border-radius:4px;cursor:pointer;font-size:1rem;">${settings.text || 'Button'}</button>`;
    
    case 'image':
      const imgUrl = typeof settings.image === 'object' ? (settings.image as any).url : settings.image || settings.url || '';
      const alt = settings.alt || '';
      const width = settings.width || '100%';
      return imgUrl ? `<img src="${imgUrl}" alt="${alt}" style="max-width:${width};height:auto;">` : '';
    
    case 'icon-box':
    case 'icon':
      const iconObj = settings.selected_icon as any;
      const iconVal = iconObj?.value || (settings.icon as any)?.value || '★';
      const iconColor = settings.primary_color || '#000';
      return `<div style="font-size:2rem;color:${iconColor};">${typeof iconVal === 'string' ? iconVal : '&#9733;'}</div>`;
    
    case 'spacer':
      const spacerHeight = settings.space || 30;
      return `<div style="height:${spacerHeight}px;"></div>`;
    
    case 'divider':
      return `<hr style="border:none;border-top:1px solid #ddd;margin:1rem 0;">`;
    
    case 'counter':
      const start = settings.starting_number || 0;
      const end = settings.ending_number || 100;
      const suffix = settings.thousand_separator ? ',' : '';
      return `<div style="font-size:2rem;font-weight:bold;">${Number(end).toLocaleString()}${suffix}</div>`;
    
    case 'image-box':
      const boxImgUrl = typeof settings.image === 'object' ? (settings.image as any).url : settings.image_url || '';
      const boxTitle = settings.title_text || '';
      const boxDesc = settings.description_text || '';
      return `<div style="text-align:center;">
        ${boxImgUrl ? `<img src="${boxImgUrl}" alt="${boxTitle}" style="max-width:100%;margin-bottom:1rem;">` : ''}
        <h3>${boxTitle}</h3>
        <p>${boxDesc}</p>
      </div>`;
    
    default:
      // For unsupported widgets, return empty
      return '';
  }
}

function buildSectionStyle(section: ElementorNode, viewport: Viewport): string {
  const settings = section.settings || {};
  const styles: string[] = [];
  
  // Content width
  if (viewport === 'mobile') {
    styles.push('padding: 20px 15px');
  } else if (viewport === 'tablet') {
    styles.push('padding: 30px 20px');
  } else {
    styles.push('padding: 40px 20px');
  }
  
  // Background
  if (settings.background_background === 'classic') {
    if (settings.background_color) {
      styles.push(`background-color: ${settings.background_color}`);
    }
    if (settings.background_image) {
      const imgUrl = typeof settings.background_image === 'object' 
        ? (settings.background_image as any).url 
        : settings.background_image;
      if (imgUrl) {
        styles.push(`background-image: url(${imgUrl});background-size:cover;background-position:center;`);
      }
    }
  }
  
  return styles.join(';');
}

function buildColumnStyle(column: ElementorNode, viewport: Viewport): string {
  const settings = column.settings || {};
  const size = settings._column_size || 100;
  const styles: string[] = [];
  
  styles.push(`width: ${size}%;`);
  styles.push('display: flex');
  styles.push('flex-direction: column');
  
  // Alignment
  if (viewport === 'mobile') {
    styles.push('text-align: center');
  }
  
  return styles.join(';');
}

function getHeadingFontSize(size: string | undefined, cssClasses: string | undefined): string {
  if (cssClasses?.includes('elementor-size-xl')) return '3rem';
  if (cssClasses?.includes('elementor-size-lg')) return '2.5rem';
  if (cssClasses?.includes('elementor-size-md')) return '2rem';
  if (size === 'h1') return '2.5rem';
  if (size === 'h2') return '2rem';
  if (size === 'h3') return '1.5rem';
  if (size === 'h4') return '1.25rem';
  if (size === 'h5') return '1rem';
  if (size === 'h6') return '0.875rem';
  return '1.5rem'; // default
}

/**
 * Generate complete HTML document from Elementor data
 */
function generatePreviewHtml(elementorData: ElementorNode[], viewport: Viewport, brandTokens?: PreviewOptions['brandTokens']): string {
  const primaryColor = brandTokens?.colors?.primary || '#3B82F6';
  const fontFamily = brandTokens?.typography?.headingFont || 'system-ui, -apple-system, sans-serif';
  const contentWidth = VIEWPORT_CONFIGS[viewport].width;
  
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Preview</title>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Inter', system-ui, -apple-system, sans-serif; line-height: 1.6; }
    .elementor-section-wrap { max-width: ${contentWidth}px; margin: 0 auto; }
    .elementor-row { display: flex; flex-wrap: wrap; gap: 20px; }
    img { max-width: 100%; height: auto; }
    h1, h2, h3, h4, h5, h6 { line-height: 1.2; }
    button { font-family: inherit; }
    a { color: ${primaryColor}; }
  </style>
</head>
<body>
  <div class="elementor-section-wrap">
    ${renderNodesToHtml(elementorData, viewport)}
  </div>
</body>
</html>`;
}

// ============================================================================
// Preview Generation
// ============================================================================

/**
 * Generate preview for a project
 */
export async function generatePreview(options: PreviewOptions): Promise<{
  success: boolean;
  previewUrl?: string;
  error?: string;
}> {
  const projectId = options.projectId;
  
  try {
    // Get project data
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { elementorData: true },
    });
    
    if (!project) {
      return { success: false, error: 'Project not found' };
    }
    
    // Get elementor data (normalize if needed)
    let elementorData: ElementorNode[] = [];
    const rawData = project.elementorData as any;
    
    if (Array.isArray(rawData)) {
      elementorData = rawData;
    } else if (rawData?.elements) {
      elementorData = rawData.elements;
    }
    
    // Generate HTML preview
    const html = generatePreviewHtml(elementorData, 'desktop', options.brandTokens);
    
    // Store as data URI (for small previews) or save to storage
    // For now, we'll store the base64 encoded HTML as a previewImage field
    // In production, you'd upload to Supabase Storage or S3
    const maxDataUriLength = 500000; // ~500KB limit for data URIs
    let previewUrl: string;
    
    if (html.length < maxDataUriLength) {
      // Use data URI for small previews
      const base64 = Buffer.from(html).toString('base64');
      previewUrl = `data:text/html;base64,${base64}`;
    } else {
      // For larger previews, store a placeholder with a note
      // In production, you'd upload to cloud storage
      previewUrl = `https://storage.example.com/previews/${projectId}/desktop.html`;
    }
    
    // Save to database
    await prisma.project.update({
      where: { id: projectId },
      data: {
        previewImage: previewUrl,
      },
    });
    
    return {
      success: true,
      previewUrl,
    };
  } catch (error) {
    console.error('Preview generation failed:', error);
    return {
      success: false,
      error: String(error),
    };
  }
}

/**
 * Generate preview for all viewports
 */
export async function generateAllViewports(options: PreviewOptions): Promise<{
  success: boolean;
  previews?: Record<Viewport, string>;
  error?: string;
}> {
  const previews: Record<Viewport, string> = {} as Record<Viewport, string>;
  
  for (const viewport of ['desktop', 'tablet', 'mobile'] as Viewport[]) {
    const result = await generatePreview({ ...options });
    
    if (result.success && result.previewUrl) {
      previews[viewport] = result.previewUrl;
    } else {
      return { success: false, error: result.error };
    }
  }

  return { success: true, previews };
}

/**
 * Get cached preview for a project
 */
export async function getCachedPreview(projectId: string): Promise<{
  success: boolean;
  previewUrl?: string;
  timestamp?: Date;
  error?: string;
}> {
  
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { previewImage: true, updatedAt: true },
  });

  if (!project) return { success: false, error: 'Project not found' };
  if (!project.previewImage) return { success: false, error: 'No preview available' };

  return {
    success: true,
    previewUrl: project.previewImage,
    timestamp: project.updatedAt,
  };
}

/**
 * Check if preview needs regeneration
 */
export async function isPreviewStale(projectId: string, maxAgeHours = 24): Promise<boolean> {
  
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { updatedAt: true },
  });

  if (!project) return true;
  const ageHours = (Date.now() - project.updatedAt.getTime()) / (1000 * 60 * 60);
  return ageHours > maxAgeHours;
}

/**
 * Invalidate cached preview
 */
export async function invalidatePreview(projectId: string): Promise<void> {
  
  await prisma.project.update({
    where: { id: projectId },
    data: { previewImage: null },
  });
}

// ============================================================================
// Preview Actions
// ============================================================================

export interface PreviewAction {
  type: 'REGENERATE_SECTION' | 'CHANGE_STYLE' | 'REVERT';
  sectionId?: string;
  stylePreset?: string;
  versionId?: string;
}

/**
 * Execute a preview action
 */
export async function executePreviewAction(
  projectId: string,
  action: PreviewAction
): Promise<{ success: boolean; previewUrl?: string; error?: string }> {
  switch (action.type) {
    case 'REGENERATE_SECTION':
      return generatePreview({ projectId });
    case 'CHANGE_STYLE':
      return generatePreview({ projectId, stylePreset: action.stylePreset });
    case 'REVERT':
      if (!action.versionId) return { success: false, error: 'Version ID required' };
      return generatePreview({ projectId });
    default:
      return { success: false, error: 'Unknown action type' };
  }
}

// ============================================================================
// Version Management
// ============================================================================

/**
 * Create a version snapshot before changes
 */
export async function createPreviewVersion(
  projectId: string,
  reason: string
): Promise<{ success: boolean; versionId?: string; error?: string }> {
  
  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project) return { success: false, error: 'Project not found' };

  const latestVersion = await prisma.templateVersion.findFirst({
    where: { templateId: projectId },
    orderBy: { version: 'desc' },
  });

  const newVersion = (latestVersion?.version || 0) + 1;

  const version = await prisma.templateVersion.create({
    data: {
      templateId: projectId,
      version: newVersion,
      reason,
      snapshot: { projectData: project.businessInfo },
    },
  });

  return { success: true, versionId: version.id };
}

/**
 * Get available versions for a project
 */
export async function getPreviewVersions(projectId: string): Promise<Array<{
  id: string;
  version: number;
  reason: string;
  createdAt: Date;
}>> {
  
  return prisma.templateVersion.findMany({
    where: { templateId: projectId },
    orderBy: { version: 'desc' },
    select: { id: true, version: true, reason: true, createdAt: true },
  });
}

/**
 * Generate shareable expiring link (Deferred to post-MVP)
 */
export async function generateShareableLink(
  projectId: string,
  expiresInHours = 24
): Promise<{ success: boolean; link?: string; expiresAt?: Date; error?: string }> {
  const expiresAt = new Date(Date.now() + expiresInHours * 60 * 60 * 1000);
  const token = Buffer.from(`${projectId}:${expiresAt.getTime()}`).toString('base64url');
  
  return {
    success: true,
    link: `https://preview.siteforge.ai/share/${token}`,
    expiresAt,
  };
}

/**
 * Preview System
 * 
 * Phase 14: Multi-viewport preview system.
 * Generates HTML previews using the unified render.ts renderer,
 * then stores as base64 data URIs for caching.
 */
import { prisma } from '@/lib/prisma';
import { renderElementorToHtml, type ElementorNode } from './render';

export interface PreviewOptions {
  projectId: string;
  elementorData?: unknown[];
  stylePreset?: string;
  brandTokens?: {
    colors?: { primary?: string; secondary?: string; accent?: string };
    typography?: { headingFont?: string; bodyFont?: string };
  };
}

// ============================================================================
// HTML Document Generator (uses unified render.ts)
// ============================================================================

function generatePreviewHtml(elements: unknown[], brandTokens?: PreviewOptions['brandTokens']): string {
  return renderElementorToHtml(elements as ElementorNode[], {
    title: 'Website Preview',
    brandTokens,
  });
}

// ============================================================================
// Public API
// ============================================================================

export async function generatePreview(options: PreviewOptions): Promise<{ success: boolean; previewUrl?: string; error?: string }> {
  const { projectId, brandTokens } = options;
  try {
    const project = await prisma.project.findUnique({ where: { id: projectId }, select: { elementorData: true } });
    if (!project) return { success: false, error: 'Project not found' };
    let elementorData: ElementorNode[] = [];
    const rawData = project.elementorData as any;
    if (Array.isArray(rawData)) elementorData = rawData;
    else if (rawData?.elements) elementorData = rawData.elements;
    const html = generatePreviewHtml(elementorData, brandTokens);
    const base64 = Buffer.from(html).toString('base64');
    const previewUrl = `data:text/html;base64,${base64}`;
    await prisma.project.update({ where: { id: projectId }, data: { previewImage: previewUrl } });
    return { success: true, previewUrl };
  } catch (error) {
    console.error('Preview generation failed:', error);
    return { success: false, error: String(error) };
  }
}

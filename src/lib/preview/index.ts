/**
 * Preview System
 * 
 * Phase 14: Multi-viewport preview system.
 * Generates HTML previews using the unified render.ts renderer,
 * then stores as base64 data URIs for caching.
 */
import { prisma } from '@/lib/prisma';
import { renderElementorToHtml, type ElementorNode } from './render';

type Viewport = 'desktop' | 'tablet' | 'mobile';

const VIEWPORT_CONFIGS = {
  desktop: { width: 1440, height: 900 },
  tablet: { width: 768, height: 1024 },
  mobile: { width: 375, height: 812 },
};

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

export async function generateAllViewports(options: PreviewOptions): Promise<{ success: boolean; previews?: Record<Viewport, string>; error?: string }> {
  const previews = {} as Record<Viewport, string>;
  for (const viewport of ['desktop', 'tablet', 'mobile'] as Viewport[]) {
    const result = await generatePreview({ ...options });
    if (result.success && result.previewUrl) previews[viewport] = result.previewUrl;
  }
  return { success: true, previews };
}

export async function getCachedPreview(projectId: string): Promise<{ success: boolean; previewUrl?: string; timestamp?: Date; error?: string }> {
  const project = await prisma.project.findUnique({ where: { id: projectId }, select: { previewImage: true, updatedAt: true } });
  if (!project) return { success: false, error: 'Project not found' };
  if (!project.previewImage) return { success: false, error: 'No preview available' };
  return { success: true, previewUrl: project.previewImage, timestamp: project.updatedAt };
}

export async function invalidatePreview(projectId: string): Promise<void> {
  await prisma.project.update({ where: { id: projectId }, data: { previewImage: null } });
}

export type { Viewport };
export const VIEWPORT_CONFIGS_EXPORT = VIEWPORT_CONFIGS;

export interface ViewportConfig {
  width: number;
  height: number;
  label: string;
  icon: string;
}

export const VIEWPORT_CONFIGS_LEGACY: Record<Viewport, ViewportConfig> = {
  desktop: { width: 1440, height: 900, label: 'Desktop', icon: 'monitor' },
  tablet: { width: 768, height: 1024, label: 'Tablet', icon: 'tablet' },
  mobile: { width: 375, height: 812, label: 'Mobile', icon: 'smartphone' },
};

export { generatePreview as generatePreviewForProject };

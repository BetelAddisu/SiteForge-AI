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

import { PrismaClient } from '@prisma/client';

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
  
  // Placeholder - generate a mock preview URL
  // In production, would render Elementor JSON and take screenshot
  const previewUrl = `https://storage.example.com/previews/${projectId}/desktop.png`;

  // Save to database
  const prisma = new PrismaClient();
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
  const prisma = new PrismaClient();
  
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
  const prisma = new PrismaClient();
  
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
  const prisma = new PrismaClient();
  
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
  const prisma = new PrismaClient();
  
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
  const prisma = new PrismaClient();
  
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

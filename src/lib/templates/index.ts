/**
 * Template queries
 *
 * Queries templates from the database via Prisma.
 * Previously used Supabase directly — migrated to use Prisma because
 * templates are stored in the public schema, not Supabase Storage.
 */

import { prisma } from '@/lib/prisma';
import type { Template, TemplateSection, Prisma } from '@prisma/client';

export type { Template };

export type TemplateWithKit = Template & {
  kit?: { id: string; name: string; slug: string; industry: string | null } | null;
  sections?: TemplateSection[];
};

/**
 * Get all templates with optional filtering
 */
export async function getTemplates(options?: {
  category?: string;
  industry?: string;
  search?: string;
  kitSlug?: string;
  limit?: number;
}): Promise<TemplateWithKit[]> {
  const where: Prisma.TemplateWhereInput = {};

  if (options?.category) where.category = options.category;
  if (options?.industry) where.industry = options.industry;
  if (options?.kitSlug) where.kitSlug = options.kitSlug;
  if (options?.search) {
    where.OR = [
      { name: { contains: options.search, mode: 'insensitive' } },
      { kitName: { contains: options.search, mode: 'insensitive' } },
      { tags: { has: options.search.toLowerCase() } },
    ];
  }

  return prisma.template.findMany({
    where,
    include: {
      kit: { select: { id: true, name: true, slug: true, industry: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: options?.limit,
  });
}

/**
 * Get a single template by ID
 */
export async function getTemplate(id: string): Promise<TemplateWithKit | null> {
  return prisma.template.findUnique({
    where: { id },
    include: {
      kit: { select: { id: true, name: true, slug: true, industry: true } },
      sections: { orderBy: { order: 'asc' } },
    },
  });
}

/**
 * Get sections for a template
 */
export async function getTemplateSections(templateId: string): Promise<TemplateSection[]> {
  return prisma.templateSection.findMany({
    where: { templateId },
    orderBy: { order: 'asc' },
  });
}

/**
 * Search templates by keyword
 */
export async function searchTemplates(query: string): Promise<TemplateWithKit[]> {
  return prisma.template.findMany({
    where: {
      OR: [
        { name: { contains: query, mode: 'insensitive' } },
        { kitName: { contains: query, mode: 'insensitive' } },
        { tags: { has: query.toLowerCase() } },
        { category: { contains: query, mode: 'insensitive' } },
        { industry: { contains: query, mode: 'insensitive' } },
      ],
    },
    include: {
      kit: { select: { id: true, name: true, slug: true, industry: true } },
    },
    orderBy: [
      { compatibilityScore: { sort: 'desc', nulls: 'last' } },
      { createdAt: 'desc' },
    ],
  });
}

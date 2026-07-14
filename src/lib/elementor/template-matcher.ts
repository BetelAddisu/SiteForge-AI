/**
 * Template Matcher
 * 
 * Phase 7: AI-powered template matching engine.
 * 
 * Matches project business info, industry, style, and brand colors
 * to recommend the best template sections.
 */

import type { Template, TemplateSection } from '@prisma/client';

// ============================================================================
// Types
// ============================================================================

export interface ProjectContext {
  businessName: string;
  industry: string;
  description?: string;
  stylePreset?: string;
  brandColors?: {
    primary?: string;
    secondary?: string;
  };
  services?: string[];
  mainService?: string;
}

export interface TemplateMatch {
  templateId: string;
  templateName: string;
  sectionType: string;
  score: number;
  matchReasons: string[];
  compatibilityScore: number;
}

export interface MatchResult {
  homepage: TemplateMatch[];
  about: TemplateMatch[];
  services: TemplateMatch[];
  contact: TemplateMatch[];
}

// ============================================================================
// Industry to Section Type Mapping
// ============================================================================

const INDUSTRY_SECTION_PREFERENCES: Record<string, string[]> = {
  technology: ['hero', 'features', 'services', 'testimonial', 'team'],
  healthcare: ['hero', 'services', 'about', 'team', 'testimonial'],
  finance: ['hero', 'services', 'about', 'testimonial', 'pricing'],
  retail: ['hero', 'services', 'gallery', 'testimonial', 'contact'],
  restaurant: ['hero', 'menu', 'about', 'gallery', 'contact'],
  'real-estate': ['hero', 'listings', 'services', 'testimonial', 'contact'],
  consulting: ['hero', 'services', 'about', 'testimonial', 'team'],
  education: ['hero', 'courses', 'about', 'team', 'testimonial'],
  creative: ['hero', 'portfolio', 'gallery', 'about', 'contact'],
  fitness: ['hero', 'services', 'gallery', 'testimonial', 'contact'],
  legal: ['hero', 'services', 'about', 'testimonial', 'contact'],
  'home-services': ['hero', 'services', 'testimonial', 'about', 'contact'],
  automotive: ['hero', 'services', 'gallery', 'testimonial', 'contact'],
  travel: ['hero', 'services', 'gallery', 'about', 'contact'],
  nonprofit: ['hero', 'about', 'services', 'testimonial', 'contact'],
  other: ['hero', 'services', 'about', 'testimonial', 'contact'],
};

// ============================================================================
// Style to Section Type Mapping
// ============================================================================

const STYLE_SECTION_PREFERENCES: Record<string, string[]> = {
  modern: ['hero', 'features', 'services', 'testimonial', 'pricing'],
  minimal: ['hero', 'about', 'services', 'contact'],
  corporate: ['hero', 'services', 'about', 'team', 'testimonial'],
  creative: ['hero', 'gallery', 'portfolio', 'about', 'contact'],
  friendly: ['hero', 'features', 'services', 'team', 'testimonial'],
  luxury: ['hero', 'services', 'about', 'gallery', 'testimonial'],
};

// ============================================================================
// Matching Functions
// ============================================================================

/**
 * Match templates to a project context
 */
export function matchTemplates(
  templates: Array<{
    id: string;
    name: string;
    category: string;
    industry?: string | null;
    style?: string | null;
    compatibilityScore?: number | null;
    sections: Array<{
      id: string;
      type: string;
      title?: string | null;
    }>;
  }>,
  context: ProjectContext
): MatchResult {
  const scores = calculateMatchScores(templates, context);
  
  // Group by page type
  const homepage: TemplateMatch[] = [];
  const about: TemplateMatch[] = [];
  const services: TemplateMatch[] = [];
  const contact: TemplateMatch[] = [];
  
  for (const [templateId, templateScores] of Object.entries(scores)) {
    const template = templates.find(t => t.id === templateId);
    if (!template) continue;
    
    const match: TemplateMatch = {
      templateId,
      templateName: template.name,
      sectionType: template.category,
      score: templateScores.total,
      matchReasons: templateScores.reasons,
      compatibilityScore: template.compatibilityScore || 0,
    };
    
    // Categorize by section type
    if (['hero', 'homepage'].includes(template.category)) {
      homepage.push(match);
    } else if (['about', 'team'].includes(template.category)) {
      about.push(match);
    } else if (['services', 'features', 'pricing'].includes(template.category)) {
      services.push(match);
    } else if (['contact', 'footer'].includes(template.category)) {
      contact.push(match);
    } else {
      homepage.push(match);
    }
  }
  
  // Sort each category by score
  const sortByScore = (a: TemplateMatch, b: TemplateMatch) => b.score - a.score;
  
  return {
    homepage: homepage.sort(sortByScore).slice(0, 10),
    about: about.sort(sortByScore).slice(0, 5),
    services: services.sort(sortByScore).slice(0, 10),
    contact: contact.sort(sortByScore).slice(0, 5),
  };
}

/**
 * Calculate match scores for each template
 */
function calculateMatchScores(
  templates: Array<{
    id: string;
    name: string;
    category: string;
    industry?: string | null;
    style?: string | null;
    compatibilityScore?: number | null;
  }>,
  context: ProjectContext
): Record<string, { total: number; reasons: string[] }> {
  const scores: Record<string, { total: number; reasons: string[] }> = {};
  
  // Get preferred section types
  const industryPreferences = INDUSTRY_SECTION_PREFERENCES[context.industry] || INDUSTRY_SECTION_PREFERENCES['other'];
  const stylePreferences = context.stylePreset 
    ? (STYLE_SECTION_PREFERENCES[context.stylePreset] || [])
    : [];
  
  for (const template of templates) {
    const reasons: string[] = [];
    let score = 0;
    
    // Industry match (40 points max)
    if (template.industry === context.industry) {
      score += 40;
      reasons.push(`Matches ${context.industry} industry`);
    } else if (!template.industry) {
      // Industry-agnostic template
      score += 20;
    }
    
    // Style match (20 points max)
    if (template.style === context.stylePreset) {
      score += 20;
      reasons.push(`${context.stylePreset} style preference`);
    }
    
    // Section type relevance (30 points max)
    const sectionRank = industryPreferences.indexOf(template.category);
    if (sectionRank >= 0) {
      score += Math.max(0, 30 - sectionRank * 5);
      reasons.push(`Recommended for ${context.industry}`);
    }
    
    // Style section preference bonus (10 points)
    const styleRank = stylePreferences.indexOf(template.category);
    if (styleRank >= 0) {
      score += Math.max(0, 10 - styleRank * 2);
    }
    
    // Compatibility score bonus (10 points)
    if (template.compatibilityScore) {
      const compatBonus = Math.round((template.compatibilityScore / 100) * 10);
      score += compatBonus;
    }
    
    scores[template.id] = { total: score, reasons };
  }
  
  return scores;
}

/**
 * Get recommended sections for a complete homepage
 */
export function getRecommendedHomepageStructure(context: ProjectContext): string[] {
  const industryPrefs = INDUSTRY_SECTION_PREFERENCES[context.industry] || INDUSTRY_SECTION_PREFERENCES['other'];
  
  // Base structure for any website
  const baseStructure: string[] = ['hero'];
  
  // Add sections based on industry
  const industrySections = industryPrefs.filter(s => s !== 'hero');
  
  // Combine and deduplicate
  const fullStructure = [...baseStructure, ...industrySections];
  
  // Limit to reasonable number of sections (4-6)
  return fullStructure.slice(0, 6);
}

/**
 * Calculate color similarity score
 */
export function calculateColorSimilarity(
  templateColors: string[],
  brandColors: { primary?: string; secondary?: string }
): number {
  if (!templateColors.length || (!brandColors.primary && !brandColors.secondary)) {
    return 0;
  }
  
  let totalScore = 0;
  const brandHexCodes = [
    brandColors.primary?.toLowerCase(),
    brandColors.secondary?.toLowerCase(),
  ].filter(Boolean);
  
  for (const templateColor of templateColors) {
    const templateLower = templateColor.toLowerCase();
    
    for (const brandHex of brandHexCodes) {
      if (brandHex && templateLower === brandHex) {
        totalScore += 50;
      } else if (brandHex && templateLower !== templateLower.replace('#', '')) {
        // Check if similar
        totalScore += 25;
      }
    }
  }
  
  return Math.min(100, totalScore);
}

/**
 * Rank templates by multiple factors
 */
export function rankTemplates(
  templates: Array<{
    id: string;
    name: string;
    category: string;
    industry?: string | null;
    style?: string | null;
    compatibilityScore?: number | null;
    previewImage?: string | null;
    tags?: string[];
  }>,
  context: ProjectContext,
  options?: {
    prioritizeCompatibility?: boolean;
    limit?: number;
  }
): TemplateMatch[] {
  const matches = matchTemplates(
    templates.map(t => ({
      ...t,
      sections: [],
    })),
    context
  );
  
  // Flatten and combine all matches
  const allMatches = [
    ...matches.homepage,
    ...matches.about,
    ...matches.services,
    ...matches.contact,
  ];
  
  // Remove duplicates (same template appearing in multiple categories)
  const seen = new Set<string>();
  const uniqueMatches = allMatches.filter(match => {
    if (seen.has(match.templateId)) return false;
    seen.add(match.templateId);
    return true;
  });
  
  // Sort by score
  uniqueMatches.sort((a, b) => {
    // If prioritizeCompatibility is set, weight that higher
    if (options?.prioritizeCompatibility) {
      const aCompat = a.compatibilityScore;
      const bCompat = b.compatibilityScore;
      if (aCompat !== bCompat) {
        return bCompat - aCompat;
      }
    }
    return b.score - a.score;
  });
  
  // Limit results
  if (options?.limit) {
    return uniqueMatches.slice(0, options.limit);
  }
  
  return uniqueMatches;
}

/**
 * Brand System
 *
 * Phase 9: Centralized brand token management.
 *
 * Merges extracted template globalStyles with user-provided or AI-generated
 * brand tokens. The merge gives priority to user tokens but never silently
 * drops template-native values that weren't explicitly overridden.
 */

import type { ElementorNode } from '@/lib/elementor/parser';

// ============================================================================
// Types
// ============================================================================

export interface BrandColor {
  primary: string;
  secondary: string;
  accent?: string;
  background?: string;
  text?: string;
  [key: string]: string | undefined;
}

export interface BrandTypography {
  headingFont: string;
  bodyFont: string;
  headingWeight?: string;
  bodyWeight?: string;
  [key: string]: string | undefined;
}

export interface BrandTokens {
  colors: BrandColor;
  typography: BrandTypography;
  style?: string;
}

export interface TemplateGlobalStyles {
  colors?: Record<string, { value?: string } | string>;
  typography?: Record<string, { value?: Record<string, string> } | string>;
  spacing?: Record<string, string>;
  buttons?: Record<string, string>;
  [key: string]: unknown;
}

export interface MergeOptions {
  /** If true, template defaults overwrite tokens when token values are empty */
  preferTemplate?: boolean;
  /** Only merge these specific token keys */
  keys?: string[];
}

// ============================================================================
// Default Tokens
// ============================================================================

export const DEFAULT_TOKENS: BrandTokens = {
  colors: {
    primary: '#3B82F6',
    secondary: '#10B981',
    accent: '#8B5CF6',
    background: '#FFFFFF',
    text: '#1F2937',
  },
  typography: {
    headingFont: 'Inter',
    bodyFont: 'Inter',
    headingWeight: '700',
    bodyWeight: '400',
  },
  style: 'modern',
};

// ============================================================================
// Brand Token Management
// ============================================================================

/**
 * Extract brand tokens from a GlobalStyles object (from Template or TemplateKit).
 * Returns default tokens for any missing values — never partial/empty tokens.
 */
export function extractBrandTokens(globalStyles?: TemplateGlobalStyles | null): BrandTokens {
  const tokens: BrandTokens = {
    colors: { ...DEFAULT_TOKENS.colors },
    typography: { ...DEFAULT_TOKENS.typography },
    style: DEFAULT_TOKENS.style,
  };

  if (!globalStyles) return tokens;

  // Extract colors
  if (globalStyles.colors) {
    for (const [key, value] of Object.entries(globalStyles.colors)) {
      const colorValue = typeof value === 'object' && value !== null
        ? (value as { value?: string }).value
        : String(value);
      if (colorValue && /^#/.test(colorValue)) {
        if (key.includes('primary')) tokens.colors.primary = colorValue;
        else if (key.includes('secondary')) tokens.colors.secondary = colorValue;
        else if (key.includes('accent')) tokens.colors.accent = colorValue;
        else if (key.includes('background') || key.includes('bg')) tokens.colors.background = colorValue;
        else if (key.includes('text')) tokens.colors.text = colorValue;
      }
    }
  }

  // Extract typography
  if (globalStyles.typography) {
    for (const [key, value] of Object.entries(globalStyles.typography)) {
      const fontValue = typeof value === 'object' && value !== null
        ? (value as { value?: Record<string, string> }).value
        : undefined;

      if (fontValue && typeof fontValue === 'object') {
        if (fontValue.font_family) {
          if (key.includes('primary') || key.includes('heading')) {
            tokens.typography.headingFont = fontValue.font_family;
          } else {
            tokens.typography.bodyFont = fontValue.font_family;
          }
        }
      }
    }
  }

  return tokens;
}

/**
 * Merge user-provided (or AI-generated) brand tokens with template defaults.
 *
 * Rule: Template defaults are never silently dropped — any token key present
 * in the template defaults that isn't explicitly overridden by user tokens
 * is preserved.
 */
export function mergeBrandTokens(
  userTokens: Partial<BrandTokens>,
  templateGlobalStyles?: TemplateGlobalStyles | null,
  options?: MergeOptions
): BrandTokens {
  const templateTokens = extractBrandTokens(templateGlobalStyles);
  const merged: BrandTokens = {
    colors: { ...templateTokens.colors },
    typography: { ...templateTokens.typography },
    style: userTokens.style || templateTokens.style || DEFAULT_TOKENS.style,
  };

  const keys = options?.keys;

  // Merge colors — user tokens override template, but empty values don't
  for (const key of Object.keys(userTokens.colors || {})) {
    if (keys && !keys.includes(`colors.${key}`)) continue;
    const value = userTokens.colors?.[key];
    if (value && value.startsWith('#')) {
      merged.colors[key] = value;
    }
  }

  // Merge typography
  for (const key of Object.keys(userTokens.typography || {})) {
    if (keys && !keys.includes(`typography.${key}`)) continue;
    const value = userTokens.typography?.[key];
    if (value) {
      merged.typography[key] = value;
    }
  }

  return merged;
}

// ============================================================================
// Elementor Tree Brand Application
// ============================================================================

/**
 * Apply brand tokens directly to an Elementor node tree.
 * Mutates nodes in place — caller should deep-clone before calling.
 *
 * Covers all widget types that the renderer supports for brand-color-aware
 * rendering. Any widget added to renderWidget()'s switch with a resolveColor
 * call should also be handled here.
 */
export function applyBrandToTree(
  nodes: ElementorNode[],
  brand: BrandTokens
): void {
  for (const node of nodes) {
    if (node.settings) {
      switch (node.widgetType) {
        case 'heading':
          if (brand.colors.primary) node.settings.title_color = brand.colors.primary;
          if (brand.typography.headingFont) node.settings.typography_font_family = brand.typography.headingFont;
          break;
        case 'button':
          if (brand.colors.primary) node.settings.background_color = brand.colors.primary;
          break;
        case 'text-editor':
          if (brand.typography.bodyFont) node.settings.typography_font_family = brand.typography.bodyFont;
          break;
        case 'counter':
          if (brand.colors.primary) node.settings.number_color = brand.colors.primary;
          if (brand.colors.text) node.settings.title_color = brand.colors.text;
          break;
        case 'progress':
        case 'progress-bar':
          if (brand.colors.primary) node.settings.inner_color = brand.colors.primary;
          if (brand.colors.background) node.settings.background_color = brand.colors.background;
          break;
        case 'call-to-action':
          if (brand.colors.primary) node.settings.background_color = brand.colors.primary;
          break;
        case 'icon-box':
          if (brand.colors.primary) node.settings.title_color = brand.colors.primary;
          if (brand.colors.text) node.settings.description_color = brand.colors.text;
          break;
        case 'image-box':
          if (brand.colors.primary) node.settings.title_color = brand.colors.primary;
          if (brand.colors.text) node.settings.description_color = brand.colors.text;
          break;
        case 'divider':
          if (brand.colors.primary) node.settings.color = brand.colors.primary;
          break;
        case 'social-icons':
          if (brand.colors.primary) node.settings.icon_color = brand.colors.primary;
          break;
        case 'testimonial':
          if (brand.colors.text) node.settings.testimonial_content_color = brand.colors.text;
          if (brand.colors.primary) node.settings.testimonial_name_color = brand.colors.primary;
          break;
        case 'star-rating':
        case 'rating':
          if (brand.colors.accent) node.settings.stars_color = brand.colors.accent;
          if (brand.colors.primary) node.settings.title_color = brand.colors.primary;
          break;
        case 'alert':
          if (brand.colors.primary) node.settings.title_color = brand.colors.primary;
          if (brand.colors.text) node.settings.description_color = brand.colors.text;
          break;
        case 'tabs':
        case 'toggle':
          if (brand.colors.primary) node.settings.title_color = brand.colors.primary;
          break;
      }
    }
    if (node.elements) {
      applyBrandToTree(node.elements, brand);
    }
  }
}

/**
 * Generate initial BrandTokens from project-level data.
 */
export function createBrandFromProjectData(data: {
  businessName?: string;
  brandColors?: { primary?: string; secondary?: string; accent?: string };
  stylePreset?: string;
}): BrandTokens {
  const base = { ...DEFAULT_TOKENS };

  if (data.brandColors?.primary) base.colors.primary = data.brandColors.primary;
  if (data.brandColors?.secondary) base.colors.secondary = data.brandColors.secondary;
  if (data.brandColors?.accent) base.colors.accent = data.brandColors.accent;
  if (data.stylePreset) base.style = data.stylePreset;

  return base;
}

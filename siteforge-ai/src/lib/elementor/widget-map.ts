/**
 * Widget Map
 * 
 * Phase 3C: Mapping table for third-party widget repairs.
 * 
 * This table expands incrementally as more templates are processed.
 * Only widgets discovered in Phase 0 samples are included.
 */

import type { ElementorNode } from './parser';

// ============================================================================
// Types
// ============================================================================

export interface RepairResult {
  success: boolean;
  modified: boolean;
  repairs: string[];
  errors: string[];
}

export type RepairHandler = (
  node: ElementorNode
) => RepairResult;

export interface WidgetMapping {
  sourceWidget: string;
  targetWidget?: string;
  handler: RepairHandler;
  description: string;
  repairable: boolean;
}

// ============================================================================
// Repair Handlers
// ============================================================================

/**
 * Replace a deprecated widget with a basic alternative
 */
function replaceWithBasicWidget(
  node: ElementorNode,
  replacementType: string
): RepairResult {
  if (node.elType !== 'widget') {
    return { success: false, modified: false, repairs: [], errors: ['Not a widget'] };
  }

  const repairs: string[] = [];
  
  // Create basic settings for replacement
  const settings = node.settings || {};
  
  // Preserve any common settings
  const preservedSettings: Record<string, unknown> = {};
  
  if (settings['title']) preservedSettings['title'] = settings['title'];
  if (settings['text']) preservedSettings['text'] = settings['text'];
  if (settings['link']) preservedSettings['link'] = settings['link'];
  if (settings['align']) preservedSettings['align'] = settings['align'];
  
  // Update the widget type
  node.widgetType = replacementType;
  node.settings = {
    ...preservedSettings,
    // Add minimal required settings for the replacement widget
    ...getMinimalSettings(replacementType),
  };
  
  repairs.push(`Replaced ${node.widgetType} with ${replacementType}`);
  
  return { success: true, modified: true, repairs, errors: [] };
}

/**
 * Get minimal settings for a replacement widget
 */
function getMinimalSettings(widgetType: string): Record<string, unknown> {
  switch (widgetType) {
    case 'heading':
      return { 'heading': 'Replaced Content', 'header_size': 'h2' };
    case 'text-editor':
      return { 'editor': '<p>Content has been replaced.</p>' };
    case 'icon':
      return { 'selected_icon': { 'value': 'fas fa-star' } };
    case 'button':
      return { 'text': 'Click Here', 'link': { 'url': '#' } };
    default:
      return {};
  }
}

/**
 * Normalize color values
 */
function normalizeColors(node: ElementorNode): RepairResult {
  if (node.elType !== 'widget' || !node.settings) {
    return { success: false, modified: false, repairs: [], errors: [] };
  }

  const repairs: string[] = [];
  const settings = node.settings;
  
  const colorFields = [
    'primary_color', 'secondary_color', 'background_color', 'text_color',
    'color', 'button_color', 'heading_color', 'icon_color', 'border_color'
  ];
  
  for (const field of colorFields) {
    const value = settings[field];
    if (typeof value === 'string') {
      const normalized = normalizeColorValue(value);
      if (normalized !== value) {
        settings[field] = normalized;
        repairs.push(`Normalized ${field} to ${normalized}`);
      }
    }
  }
  
  return { 
    success: true, 
    modified: repairs.length > 0, 
    repairs, 
    errors: [] 
  };
}

/**
 * Normalize a single color value to hex format
 */
function normalizeColorValue(value: string): string {
  // Already hex
  if (/^#[0-9A-Fa-f]{6}$/.test(value)) return value;
  
  // Short hex
  if (/^#[0-9A-Fa-f]{3}$/.test(value)) {
    const r = value[1];
    const g = value[2];
    const b = value[3];
    return `#${r}${r}${g}${g}${b}${b}`;
  }
  
  // RGB to hex
  const rgbMatch = value.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
  if (rgbMatch) {
    const r = parseInt(rgbMatch[1]).toString(16).padStart(2, '0');
    const g = parseInt(rgbMatch[2]).toString(16).padStart(2, '0');
    const b = parseInt(rgbMatch[3]).toString(16).padStart(2, '0');
    return `#${r}${g}${b}`;
  }
  
  // Leave other formats unchanged
  return value;
}

/**
 * Fix broken image URLs
 */
function fixBrokenImages(node: ElementorNode): RepairResult {
  if (!node.settings) {
    return { success: false, modified: false, repairs: [], errors: [] };
  }

  const repairs: string[] = [];
  const settings = node.settings;
  
  const imageFields = ['image', 'image_url', 'url', 'background_image'];
  
  for (const field of imageFields) {
    const value = settings[field];
    
    if (typeof value === 'string' && value.length > 0) {
      // Check for common broken URL patterns
      if (value.includes('{{') || value.includes('}}')) {
        // Template variables that weren't resolved
        settings[field] = ''; // Clear broken reference
        repairs.push(`Cleared unresolved template variable in ${field}`);
      }
    }
    
    // Handle image objects
    if (typeof value === 'object' && value !== null) {
      const imgObj = value as { url?: string; id?: number };
      if (imgObj.url) {
        if (imgObj.url.includes('{{') || imgObj.url.includes('}}')) {
          imgObj.url = '';
          repairs.push(`Cleared unresolved template variable in ${field}.url`);
        }
      }
    }
  }
  
  return { 
    success: true, 
    modified: repairs.length > 0, 
    repairs, 
    errors: [] 
  };
}

// ============================================================================
// Widget Mappings
// ============================================================================

export const WIDGET_MAP: Record<string, WidgetMapping> = {
  // Essential Addons mappings
  'ea-heading': {
    sourceWidget: 'ea-heading',
    targetWidget: 'heading',
    handler: (node) => replaceWithBasicWidget(node, 'heading'),
    description: 'Essential Addons heading → Elementor heading',
    repairable: true,
  },
  'eael-heading': {
    sourceWidget: 'eael-heading',
    targetWidget: 'heading',
    handler: (node) => replaceWithBasicWidget(node, 'heading'),
    description: 'Essential Addons heading → Elementor heading',
    repairable: true,
  },
  'ea-dual-header': {
    sourceWidget: 'ea-dual-header',
    handler: (node) => replaceWithBasicWidget(node, 'heading'),
    description: 'Essential Addons dual header → Elementor heading',
    repairable: true,
  },
  'ea-section-title': {
    sourceWidget: 'ea-section-title',
    targetWidget: 'heading',
    handler: (node) => replaceWithBasicWidget(node, 'heading'),
    description: 'Essential Addons section title → Elementor heading',
    repairable: true,
  },
  
  // Premium Addons mappings
  'ppe-heading': {
    sourceWidget: 'ppe-heading',
    targetWidget: 'heading',
    handler: (node) => replaceWithBasicWidget(node, 'heading'),
    description: 'Premium Addons heading → Elementor heading',
    repairable: true,
  },
  
  // Generic color normalization - applied to all widgets
  '_normalize_colors': {
    sourceWidget: '_normalize_colors',
    handler: normalizeColors,
    description: 'Normalize all color values to hex format',
    repairable: true,
  },
  
  // Generic image fix - applied to all widgets
  '_fix_images': {
    sourceWidget: '_fix_images',
    handler: fixBrokenImages,
    description: 'Fix broken image URLs and template variables',
    repairable: true,
  },
};

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Get all repairable widget types
 */
export function getRepairableWidgetTypes(): string[] {
  return Object.entries(WIDGET_MAP)
    .filter(([, mapping]) => mapping.repairable && !mapping.sourceWidget.startsWith('_'))
    .map(([type]) => type);
}

/**
 * Get all third-party prefixes for detection
 */
export function getThirdPartyPrefixes(): string[] {
  const prefixes = new Set<string>();
  
  for (const type of Object.keys(WIDGET_MAP)) {
    if (!type.startsWith('_')) {
      // Extract prefix from widget type
      const parts = type.split('-');
      if (parts.length > 1) {
        prefixes.add(parts[0]);
        if (parts.length > 2) {
          prefixes.add(`${parts[0]}-${parts[1]}`);
        }
      }
    }
  }
  
  return Array.from(prefixes);
}

/**
 * Check if a widget type has a repair mapping
 */
export function hasRepairMapping(widgetType: string): boolean {
  return widgetType in WIDGET_MAP;
}

/**
 * Get repair mapping for a widget type
 */
export function getRepairMapping(widgetType: string): WidgetMapping | undefined {
  return WIDGET_MAP[widgetType];
}

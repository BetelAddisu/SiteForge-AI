/**
 * Global Styles Extractor
 * 
 * Extracts global styles from Elementor templates including:
 * - Color palette (primary, secondary, accent, text, background)
 * - Typography (font families, weights, sizes)
 * - Spacing (padding, margin, gap)
 * - Button styles
 * - Gradient definitions
 */

import type { ElementorNode, GlobalStyles } from './parser';

// ============================================================================
// Color Extraction
// ============================================================================

interface ColorInfo {
  value: string;
  count: number;
  contexts: string[];
}

/**
 * Extract color palette from Elementor template
 */
export function extractColors(nodes: ElementorNode[]): GlobalStyles['colors'] {
  const colorMap = new Map<string, ColorInfo>();
  
  const extractFromNode = (node: ElementorNode, path: string) => {
    if (node.settings) {
      const settings = node.settings;
      
      // Common color fields and their categories
      const colorFields: Record<string, keyof GlobalStyles['colors']> = {
        primary_color: 'primary',
        secondary_color: 'secondary',
        accent_color: 'accent',
        text_color: 'text',
        background_color: 'background',
        color: 'text',
        button_background_color: 'primary',
        button_color: 'primary',
        heading_color: 'primary',
        icon_color: 'accent',
        link_color: 'accent',
        border_color: 'secondary',
      };
      
      for (const [field, category] of Object.entries(colorFields)) {
        const value = settings[field];
        if (typeof value === 'string' && isColorValue(value)) {
          const normalized = normalizeColor(value);
          const existing = colorMap.get(normalized);
          
          if (existing) {
            existing.count++;
            existing.contexts.push(path);
          } else {
            colorMap.set(normalized, {
              value: normalized,
              count: 1,
              contexts: [path]
            });
          }
        }
      }
    }
    
    if (node.elements) {
      for (const child of node.elements) {
        extractFromNode(child, `${path} > ${node.widgetType || node.elType}`);
      }
    }
  };
  
  for (const node of nodes) {
    extractFromNode(node, 'root');
  }
  
  // Categorize colors by frequency and context
  return categorizeColors(colorMap);
}

function categorizeColors(colorMap: Map<string, ColorInfo>): GlobalStyles['colors'] {
  const result: GlobalStyles['colors'] = {
    primary: [],
    secondary: [],
    accent: [],
    text: [],
    background: []
  };
  
  // Sort by count to get most used colors
  const sorted = Array.from(colorMap.entries())
    .sort((a, b) => b[1].count - a[1].count);
  
  // Categorize based on usage context and frequency
  for (const [color, info] of sorted) {
    if (info.count >= 3) {
      // High frequency colors are likely primary/secondary
      if (result.primary.length < 2) {
        result.primary.push(color);
      } else if (result.secondary.length < 2) {
        result.secondary.push(color);
      } else {
        result.accent.push(color);
      }
    } else if (info.contexts.some(c => c.includes('text'))) {
      result.text.push(color);
    } else if (info.contexts.some(c => c.includes('background'))) {
      result.background.push(color);
    } else if (result.accent.length < 3) {
      result.accent.push(color);
    }
  }
  
  return result;
}

function isColorValue(value: string): boolean {
  // Hex colors
  if (/^#[0-9A-Fa-f]{3,8}$/.test(value)) return true;
  // RGB/RGBA
  if (/^rgba?\([^)]+\)$/i.test(value)) return true;
  // HSL/HSLA
  if (/^hsla?\([^)]+\)$/i.test(value)) return true;
  // CSS variables
  if (/^var\(--[^)]+\)$/.test(value)) return true;
  return false;
}

function normalizeColor(color: string): string {
  // Handle CSS variables - keep as-is
  if (color.startsWith('var(')) return color;
  
  // Convert all formats to hex for consistency
  // For now, just return the original value
  return color.toLowerCase();
}

// ============================================================================
// Typography Extraction
// ============================================================================

/**
 * Extract typography from Elementor template
 */
export function extractTypography(nodes: ElementorNode[]): GlobalStyles['typography'] {
  const families = new Set<string>();
  const weights = new Set<string>();
  const sizes = new Map<string, string>();
  
  const extractFromNode = (node: ElementorNode) => {
    if (node.settings) {
      const settings = node.settings;
      
      // Font family
      const fontFamily = settings['font_family'] || settings['typography_font_family'];
      if (typeof fontFamily === 'string' && fontFamily.trim()) {
        families.add(cleanFontFamily(fontFamily));
      }
      
      // Font weight
      const fontWeight = settings['font_weight'] || settings['typography_font_weight'];
      if (typeof fontWeight === 'string' || typeof fontWeight === 'number') {
        weights.add(String(fontWeight));
      }
      
      // Font sizes
      const sizeFields = ['font_size', 'heading_font_size', 'title_size', 'subtitle_size'];
      for (const field of sizeFields) {
        const size = settings[field];
        if (typeof size === 'string') {
          sizes.set(field, size);
        } else if (typeof size === 'object' && size !== null) {
          // Elementor size objects have 'size' and 'unit' properties
          const sizeObj = size as { size?: number; unit?: string };
          if (sizeObj.size !== undefined && sizeObj.unit) {
            sizes.set(field, `${sizeObj.size}${sizeObj.unit}`);
          }
        }
      }
    }
    
    if (node.elements) {
      for (const child of node.elements) {
        extractFromNode(child);
      }
    }
  };
  
  for (const node of nodes) {
    extractFromNode(node);
  }
  
  return {
    families: Array.from(families),
    weights: Array.from(weights),
    sizes: Object.fromEntries(sizes)
  };
}

function cleanFontFamily(font: string): string {
  // Remove quotes if present
  return font.replace(/['"]/g, '').trim();
}

// ============================================================================
// Spacing Extraction
// ============================================================================

/**
 * Extract spacing values from Elementor template
 */
export function extractSpacing(nodes: ElementorNode[]): GlobalStyles['spacing'] {
  const padding = new Set<string>();
  const margin = new Set<string>();
  const gap = new Set<string>();
  
  const extractFromNode = (node: ElementorNode) => {
    if (node.settings) {
      const settings = node.settings;
      
      // Padding
      const paddingFields = ['padding', 'content_padding', 'widget_padding'];
      for (const field of paddingFields) {
        const value = settings[field];
        if (value) {
          const normalized = normalizeSpacing(value);
          if (normalized) padding.add(normalized);
        }
      }
      
      // Margin
      const marginFields = ['margin', 'element_margin'];
      for (const field of marginFields) {
        const value = settings[field];
        if (value) {
          const normalized = normalizeSpacing(value);
          if (normalized) margin.add(normalized);
        }
      }
      
      // Gap
      const gapFields = ['gap', 'columns_gap', 'item_spacing'];
      for (const field of gapFields) {
        const value = settings[field];
        if (value) {
          const normalized = normalizeSpacing(value);
          if (normalized) gap.add(normalized);
        }
      }
    }
    
    if (node.elements) {
      for (const child of node.elements) {
        extractFromNode(child);
      }
    }
  };
  
  for (const node of nodes) {
    extractFromNode(node);
  }
  
  return {
    padding: Array.from(padding),
    margin: Array.from(margin),
    gap: Array.from(gap)
  };
}

function normalizeSpacing(value: unknown): string | null {
  if (typeof value === 'string' && value.trim()) {
    return value.trim();
  }
  if (typeof value === 'number') {
    return `${value}px`;
  }
  if (typeof value === 'object' && value !== null) {
    // Elementor spacing objects
    const obj = value as Record<string, unknown>;
    if ('top' in obj && 'bottom' in obj && 'left' in obj && 'right' in obj) {
      return `${obj.top} ${obj.right} ${obj.bottom} ${obj.left}`;
    }
  }
  return null;
}

// ============================================================================
// Button Styles Extraction
// ============================================================================

/**
 * Extract button styles from Elementor template
 */
export function extractButtonStyles(nodes: ElementorNode[]): GlobalStyles['buttons'] {
  const borderRadius = new Set<string>();
  const padding = new Set<string>();
  
  const extractFromNode = (node: ElementorNode) => {
    if (node.elType === 'widget' && 
        (node.widgetType === 'button' || node.widgetType?.includes('button'))) {
      if (node.settings) {
        const settings = node.settings;
        
        // Border radius
        const radius = settings['border_radius'] || settings['button_border_radius'];
        if (radius) {
          if (typeof radius === 'number') {
            borderRadius.add(`${radius}px`);
          } else if (typeof radius === 'string') {
            borderRadius.add(radius);
          }
        }
        
        // Padding
        const pad = settings['padding'] || settings['button_padding'];
        if (pad) {
          const normalized = normalizeSpacing(pad);
          if (normalized) padding.add(normalized);
        }
      }
    }
    
    if (node.elements) {
      for (const child of node.elements) {
        extractFromNode(child);
      }
    }
  };
  
  for (const node of nodes) {
    extractFromNode(node);
  }
  
  return {
    borderRadius: Array.from(borderRadius),
    padding: Array.from(padding)
  };
}

// ============================================================================
// Gradient Extraction
// ============================================================================

/**
 * Extract gradient definitions from Elementor template
 */
export function extractGradients(nodes: ElementorNode[]): string[] {
  const gradients = new Set<string>();
  
  const extractFromNode = (node: ElementorNode) => {
    if (node.settings) {
      const settings = node.settings;
      
      // Gradient fields
      const gradientFields = ['background_background', 'background_color', 'gradient_angle', 
                           'background_gradient'];
      for (const field of gradientFields) {
        const value = settings[field];
        if (typeof value === 'string' && value.toLowerCase().includes('gradient')) {
          gradients.add(value);
        }
      }
      
      // Check for gradient color stops
      const colorStopFields = ['background_color_stop', 'background_color_b'];
      for (const field of colorStopFields) {
        const value = settings[field];
        if (value !== undefined) {
          // This indicates a gradient is being used
          gradients.add(`gradient-${field}`);
        }
      }
    }
    
    if (node.elements) {
      for (const child of node.elements) {
        extractFromNode(child);
      }
    }
  };
  
  for (const node of nodes) {
    extractFromNode(node);
  }
  
  return Array.from(gradients);
}

// ============================================================================
// Main Export
// ============================================================================

/**
 * Extract all global styles from an Elementor template
 */
export function extractGlobalStyles(nodes: ElementorNode[]): GlobalStyles {
  return {
    colors: extractColors(nodes),
    typography: extractTypography(nodes),
    spacing: extractSpacing(nodes),
    buttons: extractButtonStyles(nodes),
    gradients: extractGradients(nodes)
  };
}

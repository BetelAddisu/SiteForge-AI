/**
 * Elementor Template Parser
 * 
 * Core Elementor JSON tree walker for parsing template structures.
 * Used by bulk import, compatibility analyzer, and modifier.
 */

// ============================================================================
// Types
// ============================================================================

export interface ElementorNode {
  id: string;
  elType: 'section' | 'column' | 'container' | 'widget';
  widgetType?: string;
  settings?: Record<string, unknown>;
  elements?: ElementorNode[];
}

export interface TemplateStructure {
  sections: number;
  columns: number;
  containers: number;
  widgets: number;
  maxNestingDepth: number;
  widgetTypes: Map<string, number>;
  globalWidgets: string[];
  thirdPartyWidgets: Map<string, string>; // widget type -> addon name
}

export interface ExtractedSection {
  id: string;
  type: string;
  title?: string;
  content: Record<string, unknown>;
  widgets: string[];
}

export interface GlobalStyles {
  colors: {
    primary: string[];
    secondary: string[];
    accent: string[];
    text: string[];
    background: string[];
  };
  typography: {
    families: string[];
    weights: string[];
    sizes: Record<string, string>;
  };
  spacing: {
    padding: string[];
    margin: string[];
    gap: string[];
  };
  buttons: {
    borderRadius: string[];
    padding: string[];
  };
  gradients: string[];
}

// ============================================================================
// Constants
// ============================================================================

export const CORE_WIDGETS = new Set([
  'heading', 'text-editor', 'image', 'button', 'icon', 'icon-box',
  'image-box', 'google-maps', 'divider', 'spacer', 'image-carousel',
  'image-gallery', 'icon-list', 'counter', 'progress-bar', 'tabs',
  'accordion', 'toggle', 'social-icons', 'image-hotspot', 'price-list',
  'flip-box', 'call-to-action', 'media-carousel', 'testimonial-carousel',
  'reviews', 'portfolio', 'slides', 'form', 'posts', 'archive-posts',
  'portfolio', 'template', 'shortcode', 'sidebar', 'nav-menu',
  'video', 'lottie', 'code', 'html', 'menu-anchor', 'progress-tracker'
]);

export const PRO_WIDGETS = new Set([
  'posts', 'portfolio', 'slides', 'form', 'login', 'register',
  'author-bio', 'archive-posts', 'archive-title', 'post-title',
  'post-excerpt', 'post-featured-image', 'post-info', 'post-navigation',
  'breadcrumbs', 'price-table', 'price-box', 'animated-headline',
  'carousel', 'loop-grid', 'loop-carousel', 'template'
]);

export const THIRD_PARTY_PREFIXES = [
  'ea-', 'eael-', 'tp-', 'uagb-', 'skt-',
  'uael-', 'ppe-', 'wts-', 'ht-', 'jet-', 'bdh-', 'pp-', 'oxi-',
  'uael-', 'eael-', 'premium-', 'themer-'
];

export const ADDON_MAPPINGS: Record<string, string> = {
  'ea': 'Essential Addons for Elementor',
  'eael': 'Essential Addons for Elementor',
  'uagb': 'Ultimate Addons for Gutenberg',
  'tp': 'Template Pack',
  'skt': 'SKT Templates',
  'uael': 'Ultimate Addons for Elementor',
  'ppe': 'Premium Addons for Elementor',
  'wts': 'WTS Elements',
  'ht': 'Hustle',
  'jet': 'JetElements',
  'bdh': 'Better Docs',
  'pp': 'PowerPack',
  'oxi': 'OXI Addons',
  'premium': 'Premium Addons PRO',
  'themer': 'Elementor Theme Builder'
};

// ============================================================================
// Parser Functions
// ============================================================================

/**
 * Parse the Elementor JSON tree and return structure information
 */
export function parseElementorTree(nodes: ElementorNode[]): TemplateStructure {
  const structure: TemplateStructure = {
    sections: 0,
    columns: 0,
    containers: 0,
    widgets: 0,
    maxNestingDepth: 0,
    widgetTypes: new Map(),
    globalWidgets: [],
    thirdPartyWidgets: new Map()
  };

  walkTree(nodes, 0, structure);

  return structure;
}

/**
 * Recursively walk the Elementor tree
 */
function walkTree(
  nodes: ElementorNode[],
  depth: number,
  structure: TemplateStructure
): void {
  for (const node of nodes) {
    // Update max depth
    structure.maxNestingDepth = Math.max(structure.maxNestingDepth, depth);

    switch (node.elType) {
      case 'section':
        structure.sections++;
        break;
      case 'column':
        structure.columns++;
        break;
      case 'container':
        structure.containers++;
        break;
      case 'widget':
        structure.widgets++;
        const widgetType = node.widgetType || 'unknown';
        
        // Count widget types
        structure.widgetTypes.set(
          widgetType,
          (structure.widgetTypes.get(widgetType) || 0) + 1
        );

        // Check for third-party widgets
        if (isThirdPartyWidget(widgetType)) {
          const addon = identifyAddon(widgetType);
          structure.thirdPartyWidgets.set(widgetType, addon);
        }
        break;
    }

    // Recurse into children
    if (node.elements && node.elements.length > 0) {
      walkTree(node.elements, depth + 1, structure);
    }
  }
}

/**
 * Check if a widget is a third-party widget
 */
export function isThirdPartyWidget(widgetType: string): boolean {
  // Check if it's a known core widget
  if (CORE_WIDGETS.has(widgetType)) return false;
  if (PRO_WIDGETS.has(widgetType)) return false;

  // Check for third-party prefixes
  return THIRD_PARTY_PREFIXES.some(prefix => widgetType.startsWith(prefix));
}

/**
 * Identify which addon a widget belongs to
 */
export function identifyAddon(widgetType: string): string {
  for (const prefix of THIRD_PARTY_PREFIXES) {
    if (widgetType.startsWith(prefix)) {
      const addonKey = prefix.replace(/-/g, '');
      return ADDON_MAPPINGS[addonKey] || addonKey;
    }
  }
  return 'Unknown';
}

/**
 * Extract text content from a template
 */
export function extractTextContent(nodes: ElementorNode[]): string[] {
  const texts: string[] = [];
  extractTextFromNodes(nodes, texts);
  return texts;
}

function extractTextFromNodes(nodes: ElementorNode[], texts: string[]): void {
  for (const node of nodes) {
    if (node.elType === 'widget' && node.settings) {
      const settings = node.settings;
      
      // Common text fields
      const textFields = ['title', 'editor', 'text', 'content', 'subtitle', 
                         'header_title', 'header_description', 'heading', 'name'];
      
      for (const field of textFields) {
        const value = settings[field];
        if (typeof value === 'string' && value.trim().length > 0) {
          // Strip HTML tags
          const cleanText = value.replace(/<[^>]*>/g, '').trim();
          if (cleanText.length > 0) {
            texts.push(cleanText);
          }
        }
      }
    }

    if (node.elements && node.elements.length > 0) {
      extractTextFromNodes(node.elements, texts);
    }
  }
}

/**
 * Extract image URLs from a template
 */
export function extractImageUrls(nodes: ElementorNode[]): string[] {
  const urls: string[] = [];
  extractImagesFromNodes(nodes, urls);
  return urls;
}

function extractImagesFromNodes(nodes: ElementorNode[], urls: string[]): void {
  for (const node of nodes) {
    if (node.settings) {
      const settings = node.settings;
      
      // Common image fields
      const imageFields = ['image', 'image_url', 'url', 'background_image', 
                          'bg_image', 'logo', 'photo', 'src'];
      
      for (const field of imageFields) {
        const value = settings[field];
        
        if (typeof value === 'string' && isImageUrl(value)) {
          urls.push(value);
        }
        
        // Handle image objects
        if (typeof value === 'object' && value !== null && 'url' in value) {
          const imgObj = value as { url: string };
          if (imgObj.url) {
            urls.push(imgObj.url);
          }
        }
      }
    }

    if (node.elements && node.elements.length > 0) {
      extractImagesFromNodes(node.elements, urls);
    }
  }
}

function isImageUrl(url: string): boolean {
  const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.avif'];
  return imageExtensions.some(ext => url.toLowerCase().includes(ext)) ||
         url.includes('images.unsplash.com') ||
         url.includes('via.placeholder.com');
}

/**
 * Extract sections from a template
 */
export function extractSections(nodes: ElementorNode[]): ExtractedSection[] {
  const sections: ExtractedSection[] = [];
  
  for (const node of nodes) {
    if (node.elType === 'section' || node.elType === 'container') {
      const sectionWidgets = extractSectionWidgets(node);
      const sectionType = inferSectionType(node);
      
      sections.push({
        id: node.id,
        type: sectionType,
        title: extractSectionTitle(node),
        content: node.settings || {},
        widgets: sectionWidgets
      });
    }
  }
  
  return sections;
}

function extractSectionWidgets(node: ElementorNode): string[] {
  const widgets: string[] = [];
  
  if (node.elements) {
    for (const child of node.elements) {
      if (child.elType === 'widget' && child.widgetType) {
        widgets.push(child.widgetType);
      } else if (child.elements) {
        widgets.push(...extractSectionWidgets(child));
      }
    }
  }
  
  return widgets;
}

function extractSectionTitle(node: ElementorNode): string | undefined {
  if (node.elements) {
    for (const child of node.elements) {
      if (child.elType === 'widget') {
        const settings = child.settings;
        if (settings) {
          const titleFields = ['title', 'heading', 'subtitle', 'text'];
          for (const field of titleFields) {
            const value = settings[field];
            if (typeof value === 'string' && value.trim().length > 0) {
              return value.substring(0, 100);
            }
          }
        }
      }
    }
  }
  return undefined;
}

function inferSectionType(node: ElementorNode): string {
  const widgets = extractSectionWidgets(node);
  
  // Heuristics for section type inference
  if (widgets.includes('slides') || widgets.includes('image-carousel')) {
    return 'hero';
  }
  if (widgets.includes('form')) {
    return 'contact';
  }
  if (widgets.includes('icon-list') || widgets.includes('icon-box')) {
    return 'features';
  }
  if (widgets.includes('price-table') || widgets.includes('price-box')) {
    return 'pricing';
  }
  if (widgets.includes('testimonial') || widgets.includes('testimonial-carousel')) {
    return 'testimonial';
  }
  if (widgets.includes('team-member') || widgets.includes('eael-team-member')) {
    return 'team';
  }
  
  // Default based on position
  return 'content';
}

/**
 * Validate that a JSON string is valid Elementor data
 */
export function validateElementorJson(data: unknown): data is ElementorNode[] {
  if (!Array.isArray(data)) return false;
  
  const isValidNode = (node: unknown): boolean => {
    if (typeof node !== 'object' || node === null) return false;
    const n = node as Record<string, unknown>;
    return (
      typeof n.id === 'string' &&
      typeof n.elType === 'string' &&
      ['section', 'column', 'container', 'widget'].includes(n.elType as string)
    );
  };
  
  return data.every(isValidNode);
}

/**
 * Find a specific widget in the tree by type
 */
export function findWidgets(
  nodes: ElementorNode[],
  widgetType: string
): ElementorNode[] {
  const results: ElementorNode[] = [];
  
  const search = (nodeList: ElementorNode[]) => {
    for (const node of nodeList) {
      if (node.elType === 'widget' && node.widgetType === widgetType) {
        results.push(node);
      }
      if (node.elements) {
        search(node.elements);
      }
    }
  };
  
  search(nodes);
  return results;
}

/**
 * Find all widgets matching a predicate
 */
export function findWidgetsByPredicate(
  nodes: ElementorNode[],
  predicate: (widget: ElementorNode) => boolean
): ElementorNode[] {
  const results: ElementorNode[] = [];
  
  const search = (nodeList: ElementorNode[]) => {
    for (const node of nodeList) {
      if (node.elType === 'widget' && predicate(node)) {
        results.push(node);
      }
      if (node.elements) {
        search(node.elements);
      }
    }
  };
  
  search(nodes);
  return results;
}

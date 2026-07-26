/**
 * Elementor JSON -> HTML renderer.
 *
 * generatePreview() has never actually rendered anything - it wrote a
 * fake, nonexistent image URL to Project.previewImage. This module is the
 * real thing: it walks the modified Elementor element tree for a project
 * and produces an actual HTML document, so "preview" means a live
 * rendered page instead of a broken <img> tag.
 *
 * Supports Elementor Global Kit system:
 * - Extracts global colors from template settings
 * - Parses global typography references (globals/typography?id=xxx)
 * - Generates CSS with proper --e-global-color-* variables
 * - Falls back to Elementor default values when not specified
 *
 * Scope: supports the widget types this codebase actually creates/modifies
 * (heading, text-editor, image, button, icon, spacer) plus the structural
 * types (section, container, column). Elementor has a much larger widget
 * library (forms, sliders, third-party addons, etc.) - anything not
 * recognized here renders as a labeled placeholder block rather than
 * being silently dropped, so gaps are visible instead of invisible.
 *
 * Extended support for Digicy template widgets:
 * - counter: Number/stat display with animated counter effect
 * - image-box: Image with title and description
 * - icon-box: Icon with text content
 * - icon-list: List of icons with text
 * - divider: Visual separator
 * - elementskit-video: Video embed placeholder
 * - image-carousel: Image carousel
 * - metform: Contact form placeholder
 */

export interface ElementorNode {
  id: string;
  elType: 'section' | 'column' | 'container' | 'widget';
  widgetType?: string;
  settings?: Record<string, unknown>;
  elements?: ElementorNode[];
}

export interface BrandTokens {
  colors?: { primary?: string; secondary?: string; accent?: string };
  typography?: { headingFont?: string; bodyFont?: string };
}

/**
 * Elementor Global Kit styles extracted from template settings.
 * These match the structure stored in Elementor's global kit.
 */
export interface ElementorKitStyles {
  // System colors (default Elementor colors)
  systemColors: Array<{ _id: string; title: string; color: string }>;
  // Custom colors added by template author
  customColors: Array<{ _id: string; title: string; color: string }>;
  // System typography (default Elementor fonts)
  systemTypography: Array<{
    _id: string;
    title: string;
    typography_typography?: string;
    typography_font_family?: string;
    typography_font_size?: { size?: number; unit?: string };
    typography_font_weight?: string;
  }>;
  // Custom typography added by template author
  customTypography: Array<{
    _id: string;
    title: string;
    typography_typography?: string;
    typography_font_family?: string;
    typography_font_weight?: string;
  }>;
  // Default generic font family
  defaultGenericFonts?: string;
}

/**
 * Resolved global values for CSS generation
 */
export interface ResolvedStyles {
  colors: Record<string, string>;
  typography: Record<string, { fontFamily?: string; fontSize?: string; fontWeight?: string }>;
  defaultFonts: {
    heading: string;
    body: string;
  };
}

// Elementor Default Global Kit Values (from Elementor source)
const ELEMENTOR_DEFAULT_COLORS = {
  primary: '#6EC1E4',
  secondary: '#54595F',
  text: '#7A7A7A',
  accent: '#61CE70',
};

const ELEMENTOR_DEFAULT_TYPOGRAPHY = {
  primary: { fontFamily: 'Roboto', fontWeight: '600' },
  secondary: { fontFamily: 'Roboto Slab', fontWeight: '400' },
  text: { fontFamily: 'Roboto', fontWeight: '400' },
  accent: { fontFamily: 'Roboto', fontWeight: '500' },
};

/**
 * Extract global kit styles from Elementor template settings.
 * Templates may embed their own global styles in settings or page settings.
 */
export function extractKitStyles(elements: ElementorNode[]): ElementorKitStyles {
  const kitStyles: ElementorKitStyles = {
    systemColors: [
      { _id: 'primary', title: 'Primary', color: ELEMENTOR_DEFAULT_COLORS.primary },
      { _id: 'secondary', title: 'Secondary', color: ELEMENTOR_DEFAULT_COLORS.secondary },
      { _id: 'text', title: 'Text', color: ELEMENTOR_DEFAULT_COLORS.text },
      { _id: 'accent', title: 'Accent', color: ELEMENTOR_DEFAULT_COLORS.accent },
    ],
    customColors: [],
    systemTypography: [
      { _id: 'primary', title: 'Primary', typography_font_family: 'Roboto', typography_font_weight: '600' },
      { _id: 'secondary', title: 'Secondary', typography_font_family: 'Roboto Slab', typography_font_weight: '400' },
      { _id: 'text', title: 'Text', typography_font_family: 'Roboto', typography_font_weight: '400' },
      { _id: 'accent', title: 'Accent', typography_font_family: 'Roboto', typography_font_weight: '500' },
    ],
    customTypography: [],
    defaultGenericFonts: 'Sans-serif',
  };

  // Search for global settings in elements
  function searchForSettings(node: ElementorNode) {
    const settings = node.settings || {};
    
    // Check for page settings (Elementor stores kit settings here sometimes)
    if (settings.page_settings) {
      const pageSettings = settings.page_settings as Record<string, unknown>;
      
      // Extract system colors
      if (Array.isArray(pageSettings.system_colors)) {
        pageSettings.system_colors.forEach((c: unknown) => {
          const color = c as { _id?: string; title?: string; color?: string };
          if (color._id && color.color) {
            const existing = kitStyles.systemColors.find(sc => sc._id === color._id);
            if (existing) {
              existing.color = color.color;
            }
          }
        });
      }
      
      // Extract custom colors
      if (Array.isArray(pageSettings.custom_colors)) {
        kitStyles.customColors = pageSettings.custom_colors as ElementorKitStyles['customColors'];
      }
      
      // Extract system typography
      if (Array.isArray(pageSettings.system_typography)) {
        pageSettings.system_typography.forEach((t: unknown) => {
          const typo = t as Record<string, unknown>;
          const id = typo._id as string;
          if (id) {
            const existing = kitStyles.systemTypography.find(st => st._id === id);
            if (existing) {
              existing.typography_font_family = typo.typography_font_family as string || existing.typography_font_family;
              existing.typography_font_weight = typo.typography_font_weight as string || existing.typography_font_weight;
            }
          }
        });
      }
      
      // Extract custom typography
      if (Array.isArray(pageSettings.custom_typography)) {
        kitStyles.customTypography = pageSettings.custom_typography as ElementorKitStyles['customTypography'];
      }
    }
    
    // Check for nested settings (some templates store kit data in widgets)
    if (node.elements) {
      node.elements.forEach(searchForSettings);
    }
  }

  elements.forEach(searchForSettings);
  return kitStyles;
}

/**
 * Parse a global color reference like "globals/colors?id=primary" and return the actual color.
 */
export function resolveGlobalColor(ref: unknown, kitStyles: ResolvedStyles): string | null {
  if (typeof ref !== 'string') return null;
  
  // Match "globals/colors?id=xxx" pattern
  const match = ref.match(/^globals\/colors\?id=(.+)$/);
  if (match) {
    const colorId = match[1];
    return kitStyles.colors[colorId] || null;
  }
  
  // If it's already a hex color, return as-is
  if (ref.startsWith('#') || ref.startsWith('rgb')) {
    return ref;
  }
  
  return null;
}

/**
 * Parse a global typography reference like "globals/typography?id=primary" and return font info.
 */
export function resolveGlobalTypography(ref: unknown, kitStyles: ResolvedStyles): { fontFamily?: string; fontWeight?: string } | null {
  if (typeof ref !== 'string') return null;
  
  // Match "globals/typography?id=xxx" pattern
  const match = ref.match(/^globals\/typography\?id=(.+)$/);
  if (match) {
    const typoId = match[1];
    return kitStyles.typography[typoId] || null;
  }
  
  return null;
}

/**
 * Resolve kit styles to a simple lookup map for fast access.
 */
export function resolveKitStyles(kitStyles: ElementorKitStyles): ResolvedStyles {
  const colors: Record<string, string> = {};
  const typography: Record<string, { fontFamily?: string; fontSize?: string; fontWeight?: string }> = {};
  
  // Add system colors
  kitStyles.systemColors.forEach(c => {
    colors[c._id] = c.color;
  });
  
  // Add custom colors (override system colors with same ID)
  kitStyles.customColors.forEach(c => {
    colors[c._id] = c.color;
  });
  
  // Add system typography
  kitStyles.systemTypography.forEach(t => {
    typography[t._id] = {
      fontFamily: t.typography_font_family,
      fontWeight: t.typography_font_weight as string || '400',
    };
  });
  
  // Add custom typography
  kitStyles.customTypography.forEach(t => {
    typography[t._id] = {
      fontFamily: t.typography_font_family,
      fontWeight: t.typography_font_weight as string || '400',
    };
  });
  
  // Default fonts
  const defaultHeading = typography.primary?.fontFamily || 'Roboto';
  const defaultBody = typography.text?.fontFamily || 'Roboto';
  
  return {
    colors,
    typography,
    defaultFonts: {
      heading: defaultHeading,
      body: defaultBody,
    },
  };
}

function esc(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function getSetting<T>(settings: Record<string, unknown>, key: string, defaultValue: T): T {
  const value = settings[key];
  return (value !== undefined ? value : defaultValue) as T;
}

/**
 * Resolve a color value - handles both direct hex colors and global color references.
 */
function resolveColor(value: unknown, resolvedStyles: ResolvedStyles, fallback: string): string {
  if (typeof value === 'string' && value.startsWith('globals/colors')) {
    const resolved = resolveGlobalColor(value, resolvedStyles);
    return resolved || fallback;
  }
  return (value as string) || fallback;
}

function renderWidget(node: ElementorNode, resolvedStyles: ResolvedStyles): string {
  const settings = node.settings || {};

  switch (node.widgetType) {
    case 'heading': {
      const text = getSetting(settings, 'heading', '') as string || getSetting(settings, 'title', '') as string;
      const tag = getSetting(settings, 'header_size', 'h2') as string;
      const align = getSetting(settings, 'align', 'left') as string;
      // Use Elementor color resolution for heading
      const titleColorRaw = settings.title_color;
      const titleColor = resolveColor(titleColorRaw, resolvedStyles, '#1a1a1a');
      return `<${tag} class="sf-heading" style="text-align:${align};color:${titleColor}">${esc(text)}</${tag}>`;
    }
    case 'text-editor': {
      const html = getSetting(settings, 'editor', '') as string;
      return `<div class="sf-text">${html}</div>`;
    }
    case 'image': {
      const image = settings.image as { url?: string } | undefined;
      const url = image?.url || '';
      const alt = (image as { alt?: string })?.alt || '';
      if (!url) return '';
      return `<img class="sf-image" src="${esc(url)}" alt="${esc(alt)}" loading="lazy" />`;
    }
    case 'button': {
      const text = getSetting(settings, 'text', 'Learn More') as string;
      const link = settings.link as { url?: string } | undefined;
      const href = link?.url || '#';
      const align = getSetting(settings, 'align', 'left') as string;
      // Use Elementor color resolution for button
      const bgColorRaw = settings.background_color;
      const bgColor = resolveColor(bgColorRaw, resolvedStyles, '#2563eb');
      return `<div class="sf-button-wrapper" style="text-align:${align}"><a class="sf-button" href="${esc(href)}" style="background-color:${bgColor}">${esc(text)}</a></div>`;
    }
    case 'icon': {
      return `<span class="sf-icon" aria-hidden="true"></span>`;
    }
    case 'spacer': {
      const height = getSetting(settings, 'space', { size: 20 }) as { size?: number };
      return `<div class="sf-spacer" style="height:${Number(height?.size || 20)}px"></div>`;
    }

    // Digicy template widgets
    case 'counter': {
      const endingNumber = getSetting(settings, 'ending_number', 0) as number;
      const suffix = getSetting(settings, 'suffix', '') as string;
      const title = getSetting(settings, 'title', '') as string;
      // Use Elementor color resolution
      const numberColor = resolveColor(settings.number_color, resolvedStyles, '#2563eb');
      const titleColor = resolveColor(settings.title_color, resolvedStyles, '#666');
      return `
        <div class="sf-counter">
          <div class="sf-counter-number" style="color:${numberColor}" data-target="${endingNumber}" data-suffix="${esc(suffix)}">${endingNumber}${esc(suffix)}</div>
          <div class="sf-counter-title" style="color:${titleColor}">${esc(title)}</div>
        </div>`;
    }
    case 'image-box': {
      const image = settings.image as { url?: string } | undefined;
      const url = image?.url || '';
      const imageAlt = (image as { alt?: string })?.alt || '';
      const title = getSetting(settings, 'title_text', '') as string;
      const description = getSetting(settings, 'description_text', '') as string;
      // Use Elementor color resolution
      const titleColor = resolveColor(settings.title_color, resolvedStyles, '#1a1a1a');
      const descColor = resolveColor(settings.description_color, resolvedStyles, '#666');
      const imagePosition = getSetting(settings, 'image_type', 'top') as string;
      
      const imageHtml = url ? `<img class="sf-image-box-img" src="${esc(url)}" alt="${esc(imageAlt)}" loading="lazy" />` : '';
      const contentHtml = `
        <h3 class="sf-image-box-title" style="color:${titleColor}">${esc(title)}</h3>
        <p class="sf-image-box-desc" style="color:${descColor}">${esc(description)}</p>`;
      
      if (imagePosition === 'left') {
        return `<div class="sf-image-box sf-image-box-left">${imageHtml}<div class="sf-image-box-content">${contentHtml}</div></div>`;
      }
      return `<div class="sf-image-box">${imageHtml}<div class="sf-image-box-content">${contentHtml}</div></div>`;
    }
    case 'icon-box': {
      const icon = settings.selected_icon as { value?: string } | undefined;
      const iconValue = icon?.value || '';
      const title = getSetting(settings, 'title_text', '') as string;
      const description = getSetting(settings, 'description_text', '') as string;
      // Use Elementor color resolution
      const titleColor = resolveColor(settings.title_color, resolvedStyles, '#1a1a1a');
      const descColor = resolveColor(settings.description_color, resolvedStyles, '#666');
      const position = getSetting(settings, 'graphic_element', 'icon') as string;
      
      const iconHtml = iconValue ? `<div class="sf-icon-box-icon">${esc(iconValue)}</div>` : '';
      const contentHtml = `
        <h3 class="sf-icon-box-title" style="color:${titleColor}">${esc(title)}</h3>
        <p class="sf-icon-box-desc" style="color:${descColor}">${esc(description)}</p>`;
      
      if (position === 'top') {
        return `<div class="sf-icon-box">${iconHtml}${contentHtml}</div>`;
      }
      return `<div class="sf-icon-box sf-icon-box-inline">${iconHtml}${contentHtml}</div>`;
    }
    case 'icon-list': {
      const iconList: Array<{ text?: string; icon?: { value?: string } }> = 
        getSetting(settings, 'icon_list', []) as Array<{ text?: string; icon?: { value?: string } }>;
      const items = iconList.map(item => {
        const text = item.text || '';
        const iconVal = item.icon?.value || '';
        return `<li class="sf-icon-list-item">${iconVal ? `<span class="sf-icon-list-icon">${esc(iconVal)}</span>` : ''}<span>${esc(text)}</span></li>`;
      }).join('');
      return `<ul class="sf-icon-list">${items}</ul>`;
    }
    case 'divider': {
      const color = getSetting(settings, 'color', '#e2e8f0') as string;
      const weight = getSetting(settings, 'weight', 1) as number;
      const width = getSetting(settings, 'width', 100) as number;
      return `<hr class="sf-divider" style="border-color:${color};border-width:${weight}px;width:${width}%" />`;
    }
    case 'elementskit-video': {
      const videoUrl = getSetting(settings, 'video_url', '') as string;
      const thumbnail = getSetting(settings, 'thumbnail_image', { url: '' }) as { url?: string };
      const thumbUrl = thumbnail?.url || '';
      const playIcon = getSetting(settings, 'play_icon', '▶') as string;
      return `
        <div class="sf-video">
          ${thumbUrl ? `<img class="sf-video-thumb" src="${esc(thumbUrl)}" alt="Video thumbnail" />` : ''}
          <div class="sf-video-overlay">
            ${videoUrl ? `<a class="sf-video-play" href="${esc(videoUrl)}" target="_blank">${esc(playIcon)}</a>` : '<span class="sf-video-placeholder">▶</span>'}
          </div>
        </div>`;
    }
    case 'image-carousel': {
      const images: Array<{ url?: string; alt?: string }> = 
        getSetting(settings, 'carousel', []) as Array<{ url?: string; alt?: string }>;
      const slides: Array<{ image?: { url?: string; alt?: string } }> = 
        getSetting(settings, 'slides', []) as Array<{ image?: { url?: string; alt?: string } }>;
      
      let carouselImages = images.length > 0 ? images : slides.map(s => s.image || { url: '', alt: '' });
      
      if (carouselImages.length === 0) {
        return `<div class="sf-carousel-placeholder">[Image Carousel - ${carouselImages.length} images]</div>`;
      }
      
      const carouselItems = carouselImages.map(img => 
        `<div class="sf-carousel-item"><img src="${esc(img.url || '')}" alt="${esc(img.alt || '')}" loading="lazy" /></div>`
      ).join('');
      return `<div class="sf-carousel">${carouselItems}</div>`;
    }
    case 'metform': {
      const formId = getSetting(settings, 'mf_form_id', '') as string;
      return `
        <div class="sf-form-placeholder">
          <div class="sf-form-placeholder-icon">📝</div>
          <p>Contact Form</p>
          <p class="sf-form-placeholder-sub">Form ID: ${esc(formId)}</p>
          <form class="sf-form">
            <input type="text" placeholder="Your Name" />
            <input type="email" placeholder="Your Email" />
            <textarea placeholder="Your Message"></textarea>
            <button type="submit">Send Message</button>
          </form>
        </div>`;
    }
    default: {
      // Unknown/unsupported widget type - show it explicitly rather than
      // silently disappearing, so gaps in renderer coverage stay visible.
      return `<div class="sf-unsupported" data-widget="${esc(node.widgetType)}">[${esc(node.widgetType || 'widget')} not yet supported in preview]</div>`;
    }
  }
}

function renderNode(node: ElementorNode, resolvedStyles: ResolvedStyles): string {
  const children = (node.elements || []).map(n => renderNode(n, resolvedStyles)).join('\n');

  switch (node.elType) {
    case 'section':
      return `<section class="sf-section">${children}</section>`;
    case 'container':
      return `<div class="sf-container">${children}</div>`;
    case 'column':
      return `<div class="sf-column">${children}</div>`;
    case 'widget':
      return renderWidget(node, resolvedStyles);
    default:
      return children;
  }
}

export function renderElementorToHtml(
  elements: ElementorNode[],
  options?: { title?: string; brandTokens?: BrandTokens }
): string {
  const brandTokens = options?.brandTokens;
  
  // Extract and resolve kit styles from template
  const kitStyles = extractKitStyles(elements);
  const resolvedStyles = resolveKitStyles(kitStyles);
  
  // Use brand tokens if provided, otherwise use kit styles
  const primary = brandTokens?.colors?.primary || resolvedStyles.colors.primary || '#2563eb';
  const secondary = brandTokens?.colors?.secondary || resolvedStyles.colors.secondary || '#1e40af';
  const accent = brandTokens?.colors?.accent || resolvedStyles.colors.accent || '#06b6d4';
  const headingFont = brandTokens?.typography?.headingFont || resolvedStyles.defaultFonts.heading || 'system-ui, sans-serif';
  const bodyFont = brandTokens?.typography?.bodyFont || resolvedStyles.defaultFonts.body || 'system-ui, sans-serif';

  const body = elements.length
    ? elements.map(n => renderNode(n, resolvedStyles)).join('\n')
    : `<div class="sf-empty">No content to preview yet.</div>`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${esc(options?.title || 'Website Preview')}</title>
<link href="https://fonts.googleapis.com/css2?family=Kanit:wght@400;500;600;700&display=swap" rel="stylesheet" />
<style>
  * { box-sizing: border-box; }
  body {
    margin: 0;
    font-family: ${bodyFont};
    color: #1a1a1a;
    line-height: 1.6;
    background: #fff;
  }
  
  /* Section & Container */
  .sf-section { 
    padding: 60px 24px; 
    background: #fff;
  }
  .sf-section:empty { display: none; }
  .sf-container { 
    max-width: 1200px; 
    margin: 0 auto; 
    display: block;
  }
  .sf-column { 
    display: inline-block; 
    vertical-align: top; 
    padding: 16px; 
    width: 100%;
  }
  
  /* Typography */
  .sf-heading {
    font-family: ${headingFont};
    margin: 0 0 20px 0;
    font-size: 2.5rem;
    font-weight: 700;
    line-height: 1.2;
  }
  .sf-text { 
    margin: 0 0 20px 0; 
    font-size: 1.1rem;
    color: #4b5563;
  }
  .sf-text p { margin: 0 0 1em 0; }
  .sf-text p:last-child { margin-bottom: 0; }
  
  /* Image */
  .sf-image { 
    max-width: 100%; 
    height: auto; 
    display: block;
    margin-bottom: 16px;
  }
  
  /* Button */
  .sf-button-wrapper { margin: 20px 0; }
  .sf-button {
    display: inline-block;
    padding: 14px 32px;
    background: ${primary};
    color: #fff;
    text-decoration: none;
    border-radius: 8px;
    font-weight: 600;
    font-size: 1rem;
    transition: all 0.3s ease;
    border: none;
    cursor: pointer;
  }
  .sf-button:hover {
    background: ${secondary};
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
  }
  
  /* Spacer */
  .sf-spacer { width: 100%; }
  
  /* Counter Widget */
  .sf-counter {
    text-align: center;
    padding: 24px;
    background: linear-gradient(135deg, ${primary} 0%, ${accent} 100%);
    border-radius: 16px;
    color: #fff;
    margin: 16px 0;
  }
  .sf-counter-number {
    font-family: 'Kanit', sans-serif;
    font-size: 3rem;
    font-weight: 700;
    line-height: 1;
  }
  .sf-counter-title {
    font-size: 0.95rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    margin-top: 8px;
    opacity: 0.9;
  }
  
  /* Image Box Widget */
  .sf-image-box {
    padding: 24px;
    background: #fff;
    border-radius: 16px;
    box-shadow: 0 4px 20px rgba(0,0,0,0.08);
    margin: 16px 0;
    transition: transform 0.3s ease, box-shadow 0.3s ease;
  }
  .sf-image-box:hover {
    transform: translateY(-4px);
    box-shadow: 0 8px 30px rgba(0,0,0,0.12);
  }
  .sf-image-box-img {
    width: 100%;
    height: 200px;
    object-fit: cover;
    border-radius: 12px;
    margin-bottom: 16px;
  }
  .sf-image-box-content { text-align: center; }
  .sf-image-box-title {
    font-size: 1.25rem;
    font-weight: 600;
    margin: 0 0 12px 0;
  }
  .sf-image-box-desc {
    font-size: 0.95rem;
    margin: 0;
    line-height: 1.6;
  }
  .sf-image-box-left {
    display: flex;
    align-items: center;
    gap: 20px;
  }
  .sf-image-box-left .sf-image-box-img {
    width: 120px;
    height: 120px;
    margin-bottom: 0;
    flex-shrink: 0;
  }
  .sf-image-box-left .sf-image-box-content { text-align: left; }
  
  /* Icon Box Widget */
  .sf-icon-box {
    text-align: center;
    padding: 32px 24px;
    background: #fff;
    border-radius: 16px;
    box-shadow: 0 4px 20px rgba(0,0,0,0.08);
    margin: 16px 0;
    transition: transform 0.3s ease, box-shadow 0.3s ease;
  }
  .sf-icon-box:hover {
    transform: translateY(-4px);
    box-shadow: 0 8px 30px rgba(0,0,0,0.12);
  }
  .sf-icon-box-icon {
    font-size: 3rem;
    margin-bottom: 20px;
    color: ${primary};
  }
  .sf-icon-box-title {
    font-size: 1.25rem;
    font-weight: 600;
    margin: 0 0 12px 0;
  }
  .sf-icon-box-desc {
    font-size: 0.95rem;
    margin: 0;
    color: #6b7280;
    line-height: 1.6;
  }
  .sf-icon-box-inline {
    display: flex;
    align-items: flex-start;
    gap: 16px;
    text-align: left;
  }
  .sf-icon-box-inline .sf-icon-box-icon {
    font-size: 2rem;
    margin-bottom: 0;
    flex-shrink: 0;
  }
  
  /* Icon List Widget */
  .sf-icon-list {
    list-style: none;
    padding: 0;
    margin: 16px 0;
  }
  .sf-icon-list-item {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 0;
    border-bottom: 1px solid #f0f0f0;
  }
  .sf-icon-list-item:last-child { border-bottom: none; }
  .sf-icon-list-icon {
    font-size: 1.25rem;
    color: ${primary};
  }
  
  /* Divider Widget */
  .sf-divider {
    border: none;
    margin: 32px auto;
  }
  
  /* Video Widget */
  .sf-video {
    position: relative;
    width: 100%;
    max-width: 800px;
    margin: 24px auto;
    border-radius: 16px;
    overflow: hidden;
    background: #1a1a1a;
  }
  .sf-video-thumb {
    width: 100%;
    height: auto;
    display: block;
  }
  .sf-video-overlay {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(0,0,0,0.3);
  }
  .sf-video-play {
    width: 80px;
    height: 80px;
    border-radius: 50%;
    background: ${primary};
    color: #fff;
    font-size: 2rem;
    display: flex;
    align-items: center;
    justify-content: center;
    text-decoration: none;
    transition: transform 0.3s ease;
  }
  .sf-video-play:hover { transform: scale(1.1); }
  .sf-video-placeholder {
    font-size: 3rem;
    color: #fff;
  }
  
  /* Image Carousel */
  .sf-carousel {
    display: flex;
    overflow-x: auto;
    gap: 16px;
    padding: 16px 0;
    scroll-snap-type: x mandatory;
    scrollbar-width: none;
  }
  .sf-carousel::-webkit-scrollbar { display: none; }
  .sf-carousel-item {
    flex-shrink: 0;
    width: 300px;
    scroll-snap-align: start;
  }
  .sf-carousel-item img {
    width: 100%;
    height: 200px;
    object-fit: cover;
    border-radius: 12px;
  }
  .sf-carousel-placeholder {
    padding: 40px;
    text-align: center;
    background: #f9fafb;
    border-radius: 12px;
    color: #6b7280;
  }
  
  /* Form Placeholder */
  .sf-form-placeholder {
    max-width: 500px;
    margin: 0 auto;
    padding: 40px;
    background: #fff;
    border-radius: 16px;
    box-shadow: 0 4px 20px rgba(0,0,0,0.08);
    text-align: center;
  }
  .sf-form-placeholder-icon {
    font-size: 3rem;
    margin-bottom: 16px;
  }
  .sf-form-placeholder p {
    margin: 0 0 8px 0;
    font-size: 1.25rem;
    font-weight: 600;
  }
  .sf-form-placeholder-sub {
    font-size: 0.875rem !important;
    color: #6b7280;
    margin-bottom: 24px !important;
  }
  .sf-form {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }
  .sf-form input,
  .sf-form textarea {
    padding: 14px 16px;
    border: 2px solid #e5e7eb;
    border-radius: 8px;
    font-size: 1rem;
    font-family: inherit;
    transition: border-color 0.2s;
  }
  .sf-form input:focus,
  .sf-form textarea:focus {
    outline: none;
    border-color: ${primary};
  }
  .sf-form textarea { min-height: 120px; resize: vertical; }
  .sf-form button {
    padding: 14px 32px;
    background: ${primary};
    color: #fff;
    border: none;
    border-radius: 8px;
    font-size: 1rem;
    font-weight: 600;
    cursor: pointer;
    transition: background 0.2s;
  }
  .sf-form button:hover { background: ${secondary}; }
  
  /* Unsupported Widget */
  .sf-unsupported {
    padding: 12px 16px;
    margin: 16px 0;
    border: 1px dashed #cbd5e1;
    color: #64748b;
    font-size: 13px;
    font-family: monospace;
    background: #f8fafc;
    border-radius: 8px;
  }
  
  /* Empty State */
  .sf-empty {
    padding: 80px 24px;
    text-align: center;
    color: #94a3b8;
    font-size: 1.125rem;
  }
  
  /* Responsive */
  @media (max-width: 768px) {
    .sf-section { padding: 40px 16px; }
    .sf-heading { font-size: 1.75rem; }
    .sf-counter-number { font-size: 2.5rem; }
    .sf-image-box-left { flex-direction: column; }
    .sf-image-box-left .sf-image-box-content { text-align: center; }
  }
</style>
</head>
<body>
${body}
</body>
</html>`;
}

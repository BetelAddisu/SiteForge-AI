/**
 * Elementor JSON -> HTML renderer.
 *
 * Unified renderer that produces Elementor-faithful HTML with proper
 * elementor-section, elementor-column, and elementor-widget DOM structure.
 * Supports 30+ widget types, Global Kit colors/typography, brand tokens,
 * column widths, section backgrounds/overlays, and shape dividers.
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
export function extractKitStyles(
  elements: ElementorNode[],
  extraPageSettings?: Record<string, unknown>
): ElementorKitStyles {
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

  // Helper: resolve a value that may be a globals/colors?id= ref against parsed colors
  function resolvePsColor(value: unknown): string | undefined {
    if (typeof value !== 'string') return undefined;
    const refMatch = value.match(/^globals\/colors\?id=(.+)$/);
    if (refMatch) {
      const id = refMatch[1];
      const found = [...kitStyles.systemColors, ...kitStyles.customColors].find(c => c._id === id);
      return found?.color;
    }
    return value;
  }

  // Helper: apply theme-style page_settings onto kitStyles
  function applyPageSettings(ps: Record<string, unknown>): void {
    // System colors array (Digicy format)
    if (Array.isArray(ps.system_colors)) {
      ps.system_colors.forEach((c: unknown) => {
        const color = c as { _id?: string; title?: string; color?: string };
        if (color._id && color.color) {
          const existing = kitStyles.systemColors.find(sc => sc._id === color._id);
          if (existing) existing.color = resolvePsColor(color.color) || color.color;
        }
      });
    }
    // Custom colors array
    if (Array.isArray(ps.custom_colors)) {
      kitStyles.customColors = ps.custom_colors as ElementorKitStyles['customColors'];
    }
    // System typography array
    if (Array.isArray(ps.system_typography)) {
      ps.system_typography.forEach((t: unknown) => {
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
    // Custom typography array
    if (Array.isArray(ps.custom_typography)) {
      kitStyles.customTypography = ps.custom_typography as ElementorKitStyles['customTypography'];
    }

    // --- Theme Styles individual fields (Saras format) ---
    // Map: h1 → primary, h2 → secondary, body → text, link → accent
    const headingColorMap: Record<string, string> = {
      h1_color: 'primary', h2_color: 'secondary', h3_color: 'primary',
      h4_color: 'secondary', h5_color: 'primary', h6_color: 'secondary',
      body_color: 'text',
      link_normal_color: 'accent',
    };
    const psGlobals = ps.__globals__ as Record<string, unknown> | undefined;
    for (const [key, sysId] of Object.entries(headingColorMap)) {
      // __globals__ map takes priority over the direct (cached) value
      const rawVal = (psGlobals && psGlobals[key] as string) || (ps[key] as string | undefined);
      const val = resolvePsColor(rawVal);
      if (val) {
        const existing = kitStyles.systemColors.find(sc => sc._id === sysId);
        if (existing) existing.color = val;
      }
    }

    // Individual font-family mappings
    const headingFontMap: Record<string, string> = {
      h1_typography_font_family: 'primary', body_typography_font_family: 'text',
      h2_typography_font_family: 'secondary', link_normal_typography_font_family: 'accent',
    };
    for (const [key, sysId] of Object.entries(headingFontMap)) {
      const val = ps[key] as string | undefined;
      if (val) {
        const existing = kitStyles.systemTypography.find(st => st._id === sysId);
        if (existing) existing.typography_font_family = val;
      }
    }

    // Button theme styles
    const btnKey = (k: string) => (psGlobals && psGlobals[k] as string) || (ps[k] as string);
    const btnBg = resolvePsColor(btnKey('button_background_color'));
    const btnColor = resolvePsColor(btnKey('button_text_color'));
    const btnHoverBg = resolvePsColor(btnKey('button_hover_background_color'));
    const btnHoverColor = resolvePsColor(btnKey('button_hover_text_color'));
    if (btnBg) kitStyles.customColors.push({ _id: 'button-bg', title: 'Button Background', color: btnBg });
    if (btnColor) kitStyles.customColors.push({ _id: 'button-text', title: 'Button Text', color: btnColor });
    if (btnHoverBg) kitStyles.customColors.push({ _id: 'button-hover-bg', title: 'Button Hover Background', color: btnHoverBg });
    if (btnHoverColor) kitStyles.customColors.push({ _id: 'button-hover-text', title: 'Button Hover Text', color: btnHoverColor });
  }

  // Apply extra page settings first (from global-kit-styles.json)
  if (extraPageSettings) applyPageSettings(extraPageSettings);

  // Then search tree
  function searchForSettings(node: ElementorNode) {
    const settings = node.settings || {};
    if (settings.page_settings) {
      applyPageSettings(settings.page_settings as Record<string, unknown>);
    }
    if (node.elements) node.elements.forEach(searchForSettings);
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

/**
 * SVG placeholder used when an external image hotlink fails to load.
 * Keeps layout intact so dead template images degrade gracefully.
 */
const IMG_FALLBACK = 'data:image/svg+xml;utf8,' + encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600"><rect width="100%" height="100%" fill="#e5e7eb"/><text x="50%" y="50%" font-family="Arial" font-size="24" fill="#9ca3af" text-anchor="middle">Image unavailable</text></svg>'
);

function imgFallbackAttr(): string {
  return ` onerror="this.onerror=null;this.src='${IMG_FALLBACK}';"`;
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

/**
 * Resolve a setting that may be overridden by a global reference in __globals__.
 * Elementor stores global refs in settings.__globals__ as a map of
 * { settingKey: 'globals/colors?id=primary' | 'globals/typography?id=primary' }.
 * When present, the plain setting value is usually empty — so we must check
 * the __globals__ map first and resolve the ref to its actual color/font.
 */
function resolveSetting(
  settings: Record<string, unknown>,
  key: string,
  resolvedStyles: ResolvedStyles
): string {
  const globals = settings.__globals__ as Record<string, string> | undefined;
  const globalRef = globals?.[key];
  if (typeof globalRef === 'string') {
    if (globalRef.startsWith('globals/colors')) {
      return resolveGlobalColor(globalRef, resolvedStyles) || '';
    }
    if (globalRef.startsWith('globals/typography')) {
      const typo = resolveGlobalTypography(globalRef, resolvedStyles);
      return typo?.fontFamily || '';
    }
    return '';
  }
  return (settings[key] as string) || '';
}

// ============================================================
// Elementor Dimension Helpers
// ============================================================

function dimVal(v: unknown, fallback = ''): string {
  if (v == null || v === '') return fallback;
  if (typeof v === 'number') return `${v}px`;
  if (typeof v === 'object') {
    const o = v as Record<string, unknown>;
    if (typeof o.size === 'number') return `${o.size}${o.unit || 'px'}`;
  }
  return String(v);
}

function dimStr(v: unknown, fallback = ''): string {
  if (v == null || v === '') return fallback;
  if (typeof v === 'number') return `${v}px`;
  if (typeof v === 'object') {
    const o = v as Record<string, unknown>;
    if (typeof o.top === 'number') {
      const u = o.unit || 'px';
      const t = String(o.top), r = String(o.right ?? o.top), b = String(o.bottom ?? o.top), l = String(o.left ?? o.right ?? o.top);
      return `${t}${u} ${r}${u} ${b}${u} ${l}${u}`;
    }
    if (typeof o.size === 'number') return `${o.size}${o.unit || 'px'}`;
    if (typeof o.top === 'string') {
      const u = o.unit || 'px';
      const t = o.top, r = o.right ?? t, b = o.bottom ?? t, l = o.left ?? r;
      return `${t} ${r} ${b} ${l}`;
    }
  }
  return String(v);
}

function buildContainerStyle(settings: Record<string, unknown>, resolvedStyles?: ResolvedStyles): string {
  const parts: string[] = [];

  // Background — resolve global color refs via __globals__ when available
  const bg = settings.background_background as string;
  const bgColor = resolvedStyles
    ? resolveSetting(settings, 'background_color', resolvedStyles)
    : (settings.background_color as string) || '';
  const bgColor2 = resolvedStyles
    ? resolveSetting(settings, 'background_gradient_second_color', resolvedStyles)
    : (settings.background_gradient_second_color as string) || '';
  if (bg === 'gradient') {
    const type = (settings.background_gradient_type as string) || 'linear';
    const angle = ((settings.background_gradient_angle as { size?: number })?.size) ?? 180;
    const pos = (settings.background_gradient_position as string) || 'center center';
    if (bgColor && bgColor2) {
      const grad = type === 'radial' ? `radial-gradient(at ${pos}, ${bgColor}, ${bgColor2})` : `linear-gradient(${angle}deg, ${bgColor}, ${bgColor2})`;
      parts.push(`background:${grad}`);
    } else if (bgColor) {
      parts.push(`background:${bgColor}`);
    }
  } else if (bg === 'classic' && bgColor) {
    parts.push(`background:${bgColor}`);
  }

  // Padding
  const pad = dimStr(settings.padding);
  if (pad) parts.push(`padding:${pad}`);

  // Margin
  const marg = dimStr(settings.margin);
  if (marg) parts.push(`margin:${marg}`);

  // Border
  const bs = settings.border_border as string;
  if (bs && bs !== 'none') {
    const bw = dimStr(settings.border_width) || '1px';
    const bc = (settings.border_color as string) || '#e5e7eb';
    parts.push(`border:${bw} ${bs} ${bc}`);
  }
  const br = dimStr(settings.border_radius);
  if (br) parts.push(`border-radius:${br}`);

  // Box shadow
  if (settings.box_shadow_box_shadow === 'yes') {
    const h = dimVal(settings.box_shadow_horizontal) || '0';
    const v = dimVal(settings.box_shadow_vertical) || '2px';
    const bl = dimVal(settings.box_shadow_blur) || '4px';
    const sp = dimVal(settings.box_shadow_spread) || '0';
    const cl = (settings.box_shadow_color as string) || 'rgba(0,0,0,0.1)';
    parts.push(`box-shadow:${h} ${v} ${bl} ${sp} ${cl}`);
  }

  // Opacity
  const opacity = settings.hover_opacity as { size?: number } | number | undefined;
  const opVal = typeof opacity === 'object' ? opacity?.size : (opacity as number | undefined);
  if (opVal != null) parts.push(`opacity:${opVal}`);

  return parts.join(';');
}

function buildTypoStyle(settings: Record<string, unknown>): string {
  const parts: string[] = [];
  const ff = settings.typography_font_family as string;
  if (ff) parts.push(`font-family:${ff}`);
  const fs = dimVal(settings.typography_font_size);
  if (fs) parts.push(`font-size:${fs}`);
  const fw = settings.typography_font_weight as string;
  if (fw) parts.push(`font-weight:${fw}`);
  const lh = dimVal(settings.typography_line_height);
  if (lh) parts.push(`line-height:${lh}`);
  const ls = dimVal(settings.typography_letter_spacing);
  if (ls) parts.push(`letter-spacing:${ls}`);
  const tt = settings.typography_text_transform as string;
  if (tt && tt !== 'none') parts.push(`text-transform:${tt}`);
  const fsStyle = settings.typography_font_style as string;
  if (fsStyle) parts.push(`font-style:${fsStyle}`);
  return parts.join(';');
}

function buildHoverContainerStyle(settings: Record<string, unknown>): string {
  const parts: string[] = [];
  if (settings.background_hover_color) parts.push(`background:${settings.background_hover_color}`);
  if (settings.hover_color) parts.push(`color:${settings.hover_color}`);
  if (settings.border_hover_color) parts.push(`border-color:${settings.border_hover_color}`);
  if (settings.box_shadow_box_shadow_hover === 'yes') {
    const h = dimVal(settings.box_shadow_horizontal_hover) || '0';
    const v = dimVal(settings.box_shadow_vertical_hover) || '2px';
    const bl = dimVal(settings.box_shadow_blur_hover) || '4px';
    const sp = dimVal(settings.box_shadow_spread_hover) || '0';
    const cl = (settings.box_shadow_color_hover as string) || 'rgba(0,0,0,0.1)';
    parts.push(`box-shadow:${h} ${v} ${bl} ${sp} ${cl}`);
  }
  return parts.join(';');
}

function renderWidgetContent(node: ElementorNode, resolvedStyles: ResolvedStyles): string {
  const settings = node.settings || {};
  switch (node.widgetType) {
    case 'heading': return renderHeading(settings, resolvedStyles);
    case 'text-editor': return renderTextEditor(settings);
    case 'image': return renderImage(settings);
    case 'button': return renderButton(settings, resolvedStyles);
    case 'icon': return renderIcon(settings);
    case 'spacer': return renderSpacer(settings);
    case 'counter': return renderCounter(settings, resolvedStyles);
    case 'image-box': return renderImageBox(settings, resolvedStyles);
    case 'icon-box': return renderIconBox(settings, resolvedStyles);
    case 'icon-list': return renderIconList(settings);
    case 'divider': return renderDivider(settings);
    case 'video': return renderVideo(settings);
    case 'elementskit-video': return renderElementsKitVideo(settings);
    case 'image-carousel': return renderImageCarousel(settings);
    case 'social-icons': return renderSocialIcons(settings, resolvedStyles);
    case 'progress': return renderProgress(settings, resolvedStyles);
    case 'accordion':
    case 'elementskit-accordion': return renderAccordion(settings);
    case 'elementskit-countdown-timer': return renderCountdownTimer(settings);
    case 'posts':
    case 'elementskit-blog-posts': return renderPosts(settings);
    case 'call-to-action': return renderCallToAction(settings, resolvedStyles);
    case 'blockquote': return renderBlockquote(settings);
    case 'google_maps': return renderGoogleMaps(settings);
    case 'form': return renderForm(settings);
    case 'slides': return renderSlides(settings, resolvedStyles);
    case 'testimonial-carousel': return renderTestimonial(settings, resolvedStyles);
    case 'media-carousel': return renderImageCarousel(settings);
    case 'shortcode': return renderShortcode(settings);
    case 'html': return renderHtmlWidget(settings);
    case 'menu-anchor': return renderMenuAnchor(settings);
    case 'sidebar': return renderSidebar(settings);
    case 'metform': return renderMetForm(settings);
    case 'tabs': return renderTabs(settings, resolvedStyles);
    case 'rating': return renderRating(settings, resolvedStyles);
    case 'star-rating': return renderStarRating(settings, resolvedStyles);
    case 'testimonial': return renderTestimonial(settings, resolvedStyles);
    case 'toggle': return renderToggle(settings);
    case 'alert': return renderAlert(settings, resolvedStyles);
    default: {
      const titleKey = Object.keys(settings).find(k => k === 'title_text' || k === 'title' || k === 'heading');
      const descKey = Object.keys(settings).find(k => k === 'description_text' || k === 'description' || k === 'editor');
      if (titleKey || descKey) {
        const parts: string[] = [];
        if (titleKey && settings[titleKey]) parts.push(`<h3>${esc(settings[titleKey])}</h3>`);
        if (descKey && settings[descKey]) parts.push(`<p>${esc(settings[descKey])}</p>`);
        return `<div class="elementor-widget-container elementor-generic">${parts.join('')}</div>`;
      }
      return `<div class="elementor-widget-container sf-unsupported" data-widget="${esc(node.widgetType || '')}">[${esc(node.widgetType || 'widget')} not yet supported in preview]</div>`;
    }
  }
}

function renderHeading(settings: Record<string, unknown>, resolvedStyles: ResolvedStyles): string {
  const text = (settings.heading as string) || (settings.title as string) || '';
  const tag = (settings.header_size as string) || 'h2';
  const align = (settings.align as string) || 'left';
  const titleColor = resolveColor(settings.title_color, resolvedStyles, '#1a1a1a');
  const typoStyle = buildTypoStyle(settings);
  const colorStyle = titleColor ? `color:${titleColor}` : '';
  const sizeClass = settings.size ? ` elementor-size-${settings.size}` : ' elementor-size-default';
  return `<${tag} class="elementor-heading-title${sizeClass}" style="text-align:${align};${colorStyle};${typoStyle}">${esc(text)}</${tag}>`;
}

function renderTextEditor(settings: Record<string, unknown>): string {
  const html = (settings.editor as string) || (settings.wysiwyg as string) || '';
  const align = (settings.align as string) || 'left';
  const typoStyle = buildTypoStyle(settings);
  return `<div class="elementor-text-editor elementor-clearfix" style="text-align:${align};${typoStyle}">${html}</div>`;
}

function renderImage(settings: Record<string, unknown>): string {
  const image = settings.image as { url?: string; alt?: string; id?: number } | undefined;
  const url = image?.url || (settings.image_url as string) || '';
  const alt = image?.alt || (settings.alt as string) || '';
  if (!url) return '';
  const link = (settings.link as { url?: string })?.url;
  let imgStyle = '';
  const w = settings.width as { size?: number; unit?: string } | undefined;
  const h = settings.height as { size?: number; unit?: string } | undefined;
  if (w?.size && w.size > 0) imgStyle += `width:${w.size}${w.unit || 'px'};`;
  if (h?.size && h.size > 0) imgStyle += `height:${h.size}${h.unit || 'px'};`;
  if (settings.image_size_type === 'custom' && settings.image_custom_dimension) {
    const dim = settings.image_custom_dimension as { width?: number; height?: number };
    if (dim?.width) imgStyle += `width:${dim.width}px;`;
    if (dim?.height) imgStyle += `height:${dim.height}px;`;
  }
  if (settings.hover_animation) imgStyle += `transition:transform 0.3s;`;
  if (settings.object_fit) imgStyle += `object-fit:${settings.object_fit};`;
  const imgAttr = imgStyle ? ` style="${imgStyle}"` : '';
  const imgHtml = `<img decoding="async" src="${esc(url)}" class="attachment-large size-large" alt="${esc(alt)}" loading="lazy"${imgAttr}${imgFallbackAttr()} />`;
  if (link) return `<a href="${esc(link)}">${imgHtml}</a>`;
  return `<div class="elementor-image">${imgHtml}</div>`;
}

function renderButton(settings: Record<string, unknown>, resolvedStyles: ResolvedStyles): string {
  const text = (settings.text as string) || 'Click Here';
  const link = ((settings.link as { url?: string })?.url) || '#';
  const align = (settings.align as string) || 'left';
  const size = (settings.size as string) || 'md';
  const bgColor = resolveSetting(settings, 'background_color', resolvedStyles)
    || resolveColor(settings.background_color, resolvedStyles, '#3B82F6');
  const hoverBg = settings.background_hover_color as string || '';
  const hoverColor = settings.hover_color as string || '';
  const btnClasses = ['elementor-button', `elementor-size-${size}`];
  if (settings.button_type) btnClasses.push(`elementor-button-${settings.button_type}`);
  const typoStyle = buildTypoStyle(settings);
  const radius = dimStr(settings.border_radius) || (settings.button_border_radius ? dimStr(settings.button_border_radius) : '');
  let btnStyle = '';
  if (radius) btnStyle += `border-radius:${radius};`;
  const bs = settings.border_border as string;
  if (bs && bs !== 'none') {
    const bw = dimStr(settings.border_width) || '1px';
    const bc = (settings.border_color as string) || '#e5e7eb';
    btnStyle += `border:${bw} ${bs} ${bc};`;
  }
  if (settings.box_shadow_box_shadow === 'yes') {
    const h = dimVal(settings.box_shadow_horizontal) || '0';
    const v = dimVal(settings.box_shadow_vertical) || '2px';
    const bl = dimVal(settings.box_shadow_blur) || '4px';
    const sp = dimVal(settings.box_shadow_spread) || '0';
    const cl = (settings.box_shadow_color as string) || 'rgba(0,0,0,0.1)';
    btnStyle += `box-shadow:${h} ${v} ${bl} ${sp} ${cl};`;
  }
  const hoverAttr = hoverBg || hoverColor ? ` data-sf-normal-bg="${bgColor}" data-sf-hover-bg="${hoverBg}" data-sf-normal-color="inherit" data-sf-hover-color="${hoverColor}" onmouseover="var el=this;if(el.dataset.sfHoverBg)el.style.background=el.dataset.sfHoverBg;if(el.dataset.sfHoverColor)el.style.color=el.dataset.sfHoverColor;" onmouseout="var el=this;if(el.dataset.sfHoverBg)el.style.background=el.dataset.sfNormalBg;if(el.dataset.sfHoverColor)el.style.color=el.dataset.sfNormalColor;"` : '';
  return `<div class="elementor-button-wrapper" style="text-align:${align}">
    <a href="${esc(link)}" class="${btnClasses.join(' ')}" style="background-color:${bgColor};${typoStyle}${btnStyle}"${hoverAttr}>
      <span class="elementor-button-content-wrapper">
        ${settings.icon ? `<span class="elementor-button-icon elementor-align-icon-left"><i class="${settings.icon}"></i></span>` : ''}
        <span class="elementor-button-text">${esc(text)}</span>
      </span>
    </a>
  </div>`;
}

function renderIcon(settings: Record<string, unknown>): string {
  const iconObj = settings.selected_icon as { value?: string; library?: string } | undefined;
  const iconValue = iconObj?.value || (settings.icon as string) || '★';
  const iconLibrary = iconObj?.library || 'fa';
  const view = (settings.view as string) || 'default';
  const viewClass = view !== 'default' ? ` elementor-view-${view}` : '';
  const shape = (settings.shape as string) || '';
  const shapeClass = shape ? ` elementor-shape-${shape}` : '';
  return `<div class="elementor-icon-wrapper">
    <div class="elementor-icon${viewClass}${shapeClass}">
      <i class="${iconLibrary} ${iconValue}" aria-hidden="true"></i>
    </div>
  </div>`;
}

function renderSpacer(settings: Record<string, unknown>): string {
  const space = settings.space as { size?: number; unit?: string } | number | undefined;
  const height = typeof space === 'object' ? space?.size ?? 50 : (space as number) ?? 50;
  const unit = typeof space === 'object' ? (space?.unit || 'px') : 'px';
  return `<div class="elementor-spacer"><div class="elementor-spacer-inner" style="height:${height}${unit}"></div></div>`;
}

function renderCounter(settings: Record<string, unknown>, resolvedStyles: ResolvedStyles): string {
  const endingNumber = (settings.ending_number as number) ?? 0;
  const prefix = (settings.prefix as string) || '';
  const suffix = (settings.suffix as string) || '';
  const title = (settings.title as string) || '';
  const numberColor = resolveColor(settings.number_color, resolvedStyles, '#3B82F6');
  const titleColor = resolveColor(settings.title_color, resolvedStyles, '#666');
  const numTypo = buildTypoStyle(settings);
  return `<div class="elementor-counter">
    <div class="elementor-counter-number-wrapper">
      <span class="elementor-counter-number-prefix">${esc(prefix)}</span>
      <span class="elementor-counter-number" data-target="${endingNumber}" style="color:${numberColor};${numTypo}">${endingNumber}</span>
      <span class="elementor-counter-number-suffix">${esc(suffix)}</span>
    </div>
    ${title ? `<div class="elementor-counter-title" style="color:${titleColor}">${esc(title)}</div>` : ''}
  </div>`;
}

function renderImageBox(settings: Record<string, unknown>, resolvedStyles: ResolvedStyles): string {
  const image = settings.image as { url?: string; alt?: string } | undefined;
  const url = image?.url || '';
  const imageAlt = image?.alt || '';
  const title = (settings.title_text as string) || '';
  const description = (settings.description_text as string) || '';
  const position = (settings.image_position as string) || 'top';
  const titleColor = resolveColor(settings.title_color, resolvedStyles, '#1a1a1a');
  const descColor = resolveColor(settings.description_color, resolvedStyles, '#666');
  const titleTypo = buildTypoStyle(settings);
  const imageHtml = url ? `<figure class="elementor-image-box-img"><img src="${esc(url)}" alt="${esc(imageAlt)}" loading="lazy"${imgFallbackAttr()} /></figure>` : '';
  const contentHtml = `<div class="elementor-image-box-content">
    <h3 class="elementor-image-box-title" style="color:${titleColor};${titleTypo}">${esc(title)}</h3>
    <p class="elementor-image-box-description" style="color:${descColor}">${esc(description)}</p>
  </div>`;
  const cls = position === 'left' ? ` elementor-image-box-${position}` : '';
  return `<div class="elementor-image-box-wrapper${cls}">${imageHtml}${contentHtml}</div>`;
}

function renderIconBox(settings: Record<string, unknown>, resolvedStyles: ResolvedStyles): string {
  const iconObj = settings.selected_icon as { value?: string; library?: string } | undefined;
  const iconValue = iconObj?.value || 'fa-star';
  const iconLibrary = iconObj?.library || 'fa';
  const title = (settings.title_text as string) || '';
  const description = (settings.description_text as string) || '';
  const position = (settings.icon_position as string) || 'top';
  const titleColor = resolveColor(settings.title_color, resolvedStyles, '#1a1a1a');
  const descColor = resolveColor(settings.description_color, resolvedStyles, '#666');
  const titleTypo = buildTypoStyle(settings);
  // Resolve the per-widget primary color (may be a __globals__ ref) for the icon badge
  const primaryColor = resolveSetting(settings, 'primary_color', resolvedStyles)
    || (settings.primary_color as string)
    || '';
  const view = (settings.view as string) || 'default';
  const shape = (settings.shape as string) || '';
  const viewClass = view !== 'default' ? ` elementor-view-${view}` : '';
  const shapeClass = shape ? ` elementor-shape-${shape}` : '';
  const iconStyle = primaryColor
    ? ` style="--e-global-color-primary:${primaryColor};"`
    : '';
  return `<div class="elementor-icon-box-wrapper elementor-icon-box-${position}">
    <div class="elementor-icon-box-icon">
      <span class="elementor-icon${viewClass}${shapeClass}"${iconStyle}>
        <i class="${iconLibrary} ${iconValue}" aria-hidden="true"></i>
      </span>
    </div>
    <div class="elementor-icon-box-content">
      <h3 class="elementor-icon-box-title" style="color:${titleColor};${titleTypo}">${esc(title)}</h3>
      <p class="elementor-icon-box-description" style="color:${descColor}">${esc(description)}</p>
    </div>
  </div>`;
}

function renderIconList(settings: Record<string, unknown>): string {
  const iconList = (settings.icon_list as Array<{ text?: string; icon?: { value?: string } }>) || [];
  const items = iconList.map(item => {
    const text = item.text || '';
    const iconVal = item.icon?.value || '';
    return `<li class="elementor-icon-list-item">
      ${iconVal ? `<span class="elementor-icon-list-icon"><i class="${esc(iconVal)}"></i></span>` : ''}
      <span class="elementor-icon-list-text">${esc(text)}</span>
    </li>`;
  }).join('');
  return `<ul class="elementor-icon-list-items">${items}</ul>`;
}

function renderDivider(settings: Record<string, unknown>): string {
  const color = (settings.color as string) || '#e2e8f0';
  const weight = (settings.weight as { size?: number })?.size ?? ((settings.weight as number) ?? 1);
  const style = (settings.divider_style as string) || 'solid';
  const width = (settings.width as { size?: number })?.size ?? ((settings.width as number) ?? 100);
  const align = (settings.align as string) || '';
  const alignStyle = align ? ` margin-${align === 'center' ? 'left:auto;margin-right:auto' : align === 'right' ? 'left:auto;margin-right:0' : 'right:auto;margin-left:0'}` : ' margin:0 auto';
  return `<div class="elementor-divider">
    <span class="elementor-divider-separator" style="border-top-style:${style};border-top-width:${weight}px;border-top-color:${color};width:${width}%;${alignStyle}"></span>
  </div>`;
}

function renderVideo(settings: Record<string, unknown>): string {
  const source = (settings.video_type as string) || 'youtube';
  const url = (settings.youtube_url as string) || (settings.vimeo_url as string) || (settings.dailymotion_url as string) || (settings.url as string) || '';
  if (!url) return '';
  let embedUrl = url;
  if (source === 'youtube') {
    const match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\s]+)/);
    if (match) embedUrl = `https://www.youtube.com/embed/${match[1]}`;
  }
  return `<div class="elementor-wrapper elementor-open-lightbox">
    <div class="elementor-video-container">
      <div class="elementor-video">
        <iframe src="${esc(embedUrl)}" frameborder="0" allowfullscreen loading="lazy"></iframe>
      </div>
    </div>
  </div>`;
}

function renderElementsKitVideo(settings: Record<string, unknown>): string {
  const videoUrl = (settings.video_url as string) || '';
  const thumbnail = (settings.thumbnail_image as { url?: string }) || {};
  const thumbUrl = thumbnail?.url || '';
  if (videoUrl) {
    let embedUrl = videoUrl;
    const match = videoUrl.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\s]+)/);
    if (match) embedUrl = `https://www.youtube.com/embed/${match[1]}`;
    return `<div class="elementor-wrapper elementor-open-lightbox">
      <div class="elementor-video-container">
        <div class="elementor-video">
          <iframe src="${esc(embedUrl)}" frameborder="0" allowfullscreen loading="lazy"></iframe>
        </div>
      </div>
    </div>`;
  }
  return `<div class="elementor-wrapper">
    ${thumbUrl ? `<img src="${esc(thumbUrl)}" alt="Video thumbnail" style="width:100%;display:block;"${imgFallbackAttr()} />` : ''}
    <div class="elementor-video" style="display:flex;align-items:center;justify-content:center;background:#1a1a1a;color:#fff;min-height:200px;">
      <span style="font-size:48px;">▶</span>
    </div>
  </div>`;
}

function renderImageCarousel(settings: Record<string, unknown>): string {
  const images = (settings.carousel as Array<{ url?: string; alt?: string }>) || [];
  const slides = (settings.slides as Array<{ image?: { url?: string; alt?: string } }>) || [];
  let carouselImages = images.length > 0 ? images : slides.map(s => s.image || { url: '', alt: '' });
  if (carouselImages.length === 0) return `<div class="elementor-image-carousel-wrapper"><div class="elementor-image-carousel" style="padding:40px;text-align:center;color:#999;">[Image Carousel]</div></div>`;
  const items = carouselImages.map((img, i) =>
    `<div class="swiper-slide" data-slide="${i}"><img src="${esc(img.url || '')}" alt="${esc(img.alt || '')}" loading="lazy" style="width:100%;display:block;"${imgFallbackAttr()} /></div>`
  ).join('');
  const dots = carouselImages.map((_, i) =>
    `<span class="sf-img-dot${i === 0 ? ' sf-active' : ''}" data-slide="${i}"></span>`
  ).join('');
  return `<div class="elementor-image-carousel-wrapper sf-carousel" data-total="${carouselImages.length}">
    <div class="elementor-image-carousel swiper-container">${items}</div>
    <div class="sf-img-dots" style="display:flex;justify-content:center;gap:8px;margin-top:12px;">${dots}</div>
  </div>`;
}

function renderSocialIcons(settings: Record<string, unknown>, resolvedStyles: ResolvedStyles): string {
  const icons = (settings.social_icon_list as Array<{ social?: string; icon?: { value?: string }; link?: { url?: string }; _id?: string }>) || [];
  const items = icons.map(item => {
    const social = item.social || 'custom';
    const iconVal = item.icon?.value || 'fa-star';
    const linkUrl = item.link?.url || '#';
    return `<li class="elementor-icon-list-item">
      <a href="${esc(linkUrl)}" class="elementor-icon-list-icon" target="_blank">
        <i class="fa ${esc(iconVal)}"></i>
      </a>
      <span class="elementor-icon-list-text">${esc(social)}</span>
    </li>`;
  }).join('');
  return `<div class="elementor-social-icons-wrapper"><ul class="elementor-icon-list-items">${items}</ul></div>`;
}

function renderProgress(settings: Record<string, unknown>, resolvedStyles: ResolvedStyles): string {
  const percent = (settings.percent as { size?: number })?.size ?? ((settings.percent as number) ?? 50);
  const title = (settings.title as string) || '';
  const innerColor = resolveColor(settings.inner_color, resolvedStyles, '#3B82F6');
  const bgColor = resolveColor(settings.background_color, resolvedStyles, '#e2e8f0');
  return `<div class="elementor-progress-bar-wrapper">
    ${title ? `<span class="elementor-progress-title">${esc(title)}</span>` : ''}
    <div class="elementor-progress-bar" style="background-color:${bgColor};border-radius:2px;overflow:hidden;">
      <div class="elementor-progress-fill" style="width:${percent}%;background-color:${innerColor};height:20px;"></div>
    </div>
    <span class="elementor-progress-percentage">${percent}%</span>
  </div>`;
}

function renderAccordion(settings: Record<string, unknown>): string {
  const items = (settings.tabs as Array<{ tab_title?: string; tab_content?: string; _id?: string }>) || [];
  if (items.length === 0) return '';
  const accordionItems = items.map((item, i) => {
    const title = item.tab_title || `Tab ${i + 1}`;
    const content = item.tab_content || '';
    return `<div class="elementor-accordion-item">
      <div class="elementor-tab-title" data-tab="${i}">
        <a class="elementor-accordion-title" tabindex="0">${esc(title)}</a>
      </div>
      <div class="elementor-tab-content elementor-clearfix" data-tab="${i}" style="display:${i === 0 ? 'block' : 'none'}">
        ${content}
      </div>
    </div>`;
  }).join('');
  return `<div class="elementor-accordion" role="tablist">${accordionItems}</div>`;
}

function renderCountdownTimer(settings: Record<string, unknown>): string {
  const date = (settings.due_date as string) || '';
  const labels = (settings.label_text as Record<string, string>) || { days: 'Days', hours: 'Hours', minutes: 'Minutes', seconds: 'Seconds' };
  if (!date) return `<div class="elementor-countdown-wrapper" style="padding:20px;text-align:center;color:#999;">[Countdown Timer]</div>`;
  return `<div class="elementor-countdown-wrapper" data-date="${esc(date)}" style="display:flex;gap:20px;justify-content:center;flex-wrap:wrap;">
    <div class="elementor-countdown-item"><span class="elementor-countdown-number">00</span><span class="elementor-countdown-label">${esc(labels.days || 'Days')}</span></div>
    <div class="elementor-countdown-item"><span class="elementor-countdown-number">00</span><span class="elementor-countdown-label">${esc(labels.hours || 'Hours')}</span></div>
    <div class="elementor-countdown-item"><span class="elementor-countdown-number">00</span><span class="elementor-countdown-label">${esc(labels.minutes || 'Minutes')}</span></div>
    <div class="elementor-countdown-item"><span class="elementor-countdown-number">00</span><span class="elementor-countdown-label">${esc(labels.seconds || 'Seconds')}</span></div>
  </div>`;
}

function renderPosts(settings: Record<string, unknown>): string {
  const number = (settings.posts_count as number) ?? 3;
  const title = (settings.post_title as string) || '';
  const cols = (settings.columns as number) ?? 3;
  const dummyPosts = Array.from({ length: Math.min(number, 6) }, (_, i) => ({
    title: `${title || 'Post'} ${i + 1}`,
    excerpt: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit.',
  }));
  const items = dummyPosts.map(post =>
    `<div class="elementor-post" style="border:1px solid #eee;border-radius:8px;overflow:hidden;">
      <div style="height:150px;background:#e2e8f0;"></div>
      <div style="padding:16px;">
        <h3 style="margin:0 0 8px;font-size:1.1rem;">${esc(post.title)}</h3>
        <p style="margin:0;color:#666;font-size:0.9rem;">${esc(post.excerpt)}</p>
      </div>
    </div>`
  ).join('');
  return `<div class="elementor-posts-container elementor-posts" style="display:grid;grid-template-columns:repeat(${Math.min(cols, 3)}, 1fr);gap:20px;">${items}</div>`;
}

function renderCallToAction(settings: Record<string, unknown>, resolvedStyles: ResolvedStyles): string {
  const title = (settings.title as string) || '';
  const description = (settings.description as string) || '';
  const btnText = (settings.button_text as string) || 'Learn More';
  const btnLink = ((settings.link as { url?: string })?.url) || '#';
  const bgColor = resolveColor(settings.background_color, resolvedStyles, '#3B82F6');
  const titleTypo = buildTypoStyle(settings);
  const hoverAttr = settings.background_hover_color ? ` data-sf-hover-bg="${settings.background_hover_color}" data-sf-normal-bg="${bgColor}" onmouseover="if(this.dataset.sfHoverBg)this.style.background=this.dataset.sfHoverBg" onmouseout="if(this.dataset.sfNormalBg)this.style.background=this.dataset.sfNormalBg"` : '';
  return `<div class="elementor-cta" style="background-color:${bgColor};border-radius:8px;padding:40px;text-align:center;color:#fff;"${hoverAttr}>
    <h2 class="elementor-cta__title" style="margin:0 0 12px;${titleTypo}">${esc(title)}</h2>
    <p class="elementor-cta__description" style="margin:0 0 20px;">${esc(description)}</p>
    <a href="${esc(btnLink)}" class="elementor-button" style="background-color:#fff;color:#333;">${esc(btnText)}</a>
  </div>`;
}

function renderBlockquote(settings: Record<string, unknown>): string {
  const content = (settings.block_content as string) || (settings.content as string) || '';
  const author = (settings.author as string) || '';
  return `<blockquote class="elementor-blockquote">
    <p class="elementor-blockquote__content" style="font-style:italic;font-size:1.1rem;line-height:1.6;margin:0 0 12px;">${esc(content)}</p>
    ${author ? `<footer class="elementor-blockquote__author" style="font-weight:600;">— ${esc(author)}</footer>` : ''}
  </blockquote>`;
}

function renderGoogleMaps(settings: Record<string, unknown>): string {
  const address = encodeURIComponent(String(settings.address || ''));
  const zoom = ((settings.zoom as { size?: number })?.size) || 10;
  if (!address) return `<div class="elementor-custom-embed" style="padding:40px;text-align:center;color:#999;">[Google Maps - no address]</div>`;
  return `<div class="elementor-custom-embed">
    <iframe frameborder="0" scrolling="no" marginheight="0" marginwidth="0"
      src="https://maps.google.com/maps?q=${address}&t=m&z=${zoom}&output=embed&iwloc=near"
      title="${esc(settings.address as string)}" aria-label="${esc(settings.address as string)}"
      style="width:100%;height:300px;"></iframe>
  </div>`;
}

function renderForm(settings: Record<string, unknown>): string {
  const formName = (settings.form_name as string) || '';
  return `<div class="elementor-form-wrapper">
    ${formName ? `<h3 style="margin:0 0 16px;">${esc(formName)}</h3>` : ''}
    <form class="elementor-form" style="display:flex;flex-direction:column;gap:12px;">
      <input type="text" placeholder="Name" style="padding:12px;border:1px solid #d3d3d3;border-radius:3px;" />
      <input type="email" placeholder="Email" style="padding:12px;border:1px solid #d3d3d3;border-radius:3px;" />
      <textarea placeholder="Message" style="padding:12px;border:1px solid #d3d3d3;border-radius:3px;min-height:100px;"></textarea>
      <button type="submit" class="elementor-button">Submit</button>
    </form>
  </div>`;
}

function renderSlides(settings: Record<string, unknown>, resolvedStyles: ResolvedStyles): string {
  const slides = (settings.slides as Array<{ heading?: string; description?: string; button_text?: string; link?: { url?: string }; background_image?: { url?: string } }>) || [];
  if (slides.length === 0) return `<div class="elementor-slides-wrapper" style="padding:80px;text-align:center;background:#1a1a1a;color:#fff;">[Slideshow]</div>`;
  const items = slides.map((slide, i) => {
    const bg = slide.background_image?.url || '';
    const bgStyle = bg ? `background-image:url(${esc(bg)});background-size:cover;background-position:center;` : 'background:#1a1a1a;';
    return `<div class="elementor-slide" data-slide="${i}" style="display:none;flex-direction:column;align-items:center;justify-content:center;min-height:500px;${bgStyle}padding:60px 40px;text-align:center;color:#fff;">
      ${slide.heading ? `<h2 class="elementor-slide-heading" style="font-size:2.5rem;margin:0 0 16px;">${esc(slide.heading)}</h2>` : ''}
      ${slide.description ? `<p class="elementor-slide-description" style="font-size:1.2rem;margin:0 0 24px;max-width:600px;">${esc(slide.description)}</p>` : ''}
      ${slide.button_text ? `<a href="${esc(slide.link?.url || '#')}" class="elementor-button" style="background-color:#fff;color:#333;">${esc(slide.button_text)}</a>` : ''}
    </div>`;
  }).join('');
  const dots = slides.map((_, i) =>
    `<span class="sf-slide-dot${i === 0 ? ' sf-active' : ''}" data-slide="${i}"></span>`
  ).join('');
  return `<div class="elementor-slides-wrapper sf-carousel" data-total="${slides.length}">
    ${items}
    <button class="sf-slide-arrow sf-slide-prev" aria-label="Previous">&#10094;</button>
    <button class="sf-slide-arrow sf-slide-next" aria-label="Next">&#10095;</button>
    <div class="sf-slide-dots">${dots}</div>
  </div>`;
}

function renderShortcode(settings: Record<string, unknown>): string {
  return `<div class="elementor-shortcode">${esc(settings.shortcode as string || '')}</div>`;
}

function renderHtmlWidget(settings: Record<string, unknown>): string {
  return String(settings.html || '');
}

function renderMenuAnchor(settings: Record<string, unknown>): string {
  const anchor = (settings.anchor as string) || '';
  return `<div id="${esc(anchor)}" class="elementor-menu-anchor"></div>`;
}

function renderSidebar(settings: Record<string, unknown>): string {
  return `<div class="elementor-sidebar">${esc(settings.sidebar as string || '')}</div>`;
}

function renderMetForm(settings: Record<string, unknown>): string {
  const formId = (settings.mf_form_id as string) || '';
  return `<div class="elementor-metform" style="max-width:500px;margin:0 auto;padding:24px;border:1px solid #e5e7eb;border-radius:8px;">
    <form class="elementor-form" style="display:flex;flex-direction:column;gap:12px;">
      <input type="text" placeholder="Your Name" style="padding:12px;border:1px solid #d3d3d3;border-radius:3px;" />
      <input type="email" placeholder="Your Email" style="padding:12px;border:1px solid #d3d3d3;border-radius:3px;" />
      <textarea placeholder="Your Message" style="padding:12px;border:1px solid #d3d3d3;border-radius:3px;min-height:100px;"></textarea>
      <button type="submit" class="elementor-button elementor-size-md">Send Message</button>
    </form>
    ${formId ? `<p style="margin:8px 0 0;font-size:0.8rem;color:#999;text-align:center;">Form ID: ${esc(formId)}</p>` : ''}
  </div>`;
}

function renderTestimonial(settings: Record<string, unknown>, resolvedStyles: ResolvedStyles): string {
  const content = (settings.testimonial_content as string) || '';
  const name = (settings.testimonial_name as string) || '';
  const job = (settings.testimonial_job as string) || '';
  const image = settings.testimonial_image as { url?: string; alt?: string } | undefined;
  const imageUrl = image?.url || '';
  const nameColor = resolveColor(settings.testimonial_name_color, resolvedStyles, '#1a1a1a');
  const contentColor = resolveColor(settings.testimonial_content_color, resolvedStyles, '#666');
  const alignment = (settings.testimonial_alignment as string) || 'center';
  let html = `<div class="elementor-testimonial" style="text-align:${alignment}">`;
  if (imageUrl) {
    html += `<div class="elementor-testimonial__image"><img src="${esc(imageUrl)}" alt="${esc(image?.alt || name)}" loading="lazy" style="width:60px;height:60px;border-radius:50%;object-fit:cover;margin:0 auto 12px;"${imgFallbackAttr()} /></div>`;
  }
  html += `<blockquote class="elementor-testimonial__content" style="color:${contentColor};font-style:italic;margin:0 0 12px;font-size:1.05rem;">${esc(content)}</blockquote>`;
  if (name) html += `<cite class="elementor-testimonial__name" style="font-style:normal;font-weight:600;color:${nameColor}">${esc(name)}</cite>`;
  if (job) html += `<span class="elementor-testimonial__job" style="display:block;font-size:0.9rem;color:#999;margin-top:4px;">${esc(job)}</span>`;
  html += '</div>';
  return html;
}

function renderStarRating(settings: Record<string, unknown>, resolvedStyles: ResolvedStyles): string {
  const scale = (settings.rating_scale as number) || 5;
  const rating = (settings.rating as number) || 0;
  const title = (settings.title as string) || '';
  const align = (settings.align as string) || 'left';
  const starColor = resolveColor(settings.stars_color, resolvedStyles, '#f0ad4e');
  const unmarkedColor = resolveColor(settings.stars_unmarked_color, resolvedStyles, '#e2e8f0');
  const titleColor = resolveColor(settings.title_color, resolvedStyles, '#1a1a1a');
  let stars = '';
  for (let i = 0; i < scale; i++) {
    const filled = i < Math.round(rating);
    stars += `<span class="elementor-star" style="color:${filled ? starColor : unmarkedColor};font-size:1.5rem;">&#9733;</span>`;
  }
  return `<div class="elementor-star-rating" style="text-align:${align}">
    ${title ? `<p class="elementor-star-rating__title" style="color:${titleColor};margin:0 0 8px;font-weight:600;">${esc(title)}</p>` : ''}
    <div class="elementor-star-rating__wrapper">${stars}</div>
  </div>`;
}

function renderRating(settings: Record<string, unknown>, resolvedStyles: ResolvedStyles): string {
  const scale = (settings.rating_scale as number) || 5;
  const rating = (settings.rating as number) || 0;
  const iconColor = resolveColor(settings.icon_color, resolvedStyles, '#f0ad4e');
  const icon = (settings.icon as { value?: string })?.value || 'fa-star';
  let icons = '';
  for (let i = 0; i < scale; i++) {
    const filled = i < Math.round(rating);
    icons += `<i class="fa ${esc(icon)}" style="color:${filled ? iconColor : '#e2e8f0'};font-size:1.5rem;margin:0 2px;" aria-hidden="true"></i>`;
  }
  return `<div class="elementor-rating">${icons}</div>`;
}

function renderTabs(settings: Record<string, unknown>, resolvedStyles: ResolvedStyles): string {
  const items = (settings.tabs as Array<{ tab_title?: string; tab_content?: string; _id?: string }>) || [];
  if (items.length === 0) return '';
  const type = (settings.type as string) || 'horizontal';
  const titleColor = resolveColor(settings.title_color, resolvedStyles, '#1a1a1a');
  const titles = items.map((item, i) =>
    `<div class="elementor-tab-title elementor-tab-desktop-title${i === 0 ? ' elementor-active' : ''}" data-tab="${i}" style="color:${titleColor}">
      <a style="color:inherit;text-decoration:none;">${esc(item.tab_title || `Tab ${i + 1}`)}</a>
    </div>`
  ).join('');
  const contents = items.map((item, i) =>
    `<div class="elementor-tab-content elementor-clearfix${i === 0 ? ' elementor-active' : ''}" data-tab="${i}"${i !== 0 ? ' style="display:none;"' : ''}>
      ${item.tab_content || ''}
    </div>`
  ).join('');
  return `<div class="elementor-tabs elementor-tabs-${type}">
    <div class="elementor-tabs-wrapper">${titles}</div>
    <div class="elementor-tabs-content-wrapper">${contents}</div>
  </div>`;
}

function renderToggle(settings: Record<string, unknown>): string {
  const items = (settings.tabs as Array<{ tab_title?: string; tab_content?: string; _id?: string }>) || [];
  if (items.length === 0) return '';
  const titleTag = (settings.title_html_tag as string) || 'div';
  const toggleItems = items.map((item, i) => {
    const title = item.tab_title || `Item ${i + 1}`;
    const content = item.tab_content || '';
    return `<div class="elementor-toggle-item">
      <${titleTag} class="elementor-tab-title" data-tab="${i}">
        <a class="elementor-toggle-title" tabindex="0" style="text-decoration:none;color:inherit;">${esc(title)}</a>
      </${titleTag}>
      <div class="elementor-tab-content elementor-clearfix" data-tab="${i}" style="display:${i === 0 ? 'block' : 'none'}">
        ${content}
      </div>
    </div>`;
  }).join('');
  return `<div class="elementor-toggle" role="tablist">${toggleItems}</div>`;
}

function renderAlert(settings: Record<string, unknown>, resolvedStyles: ResolvedStyles): string {
  const type = (settings.alert_type as string) || 'info';
  const title = (settings.alert_title as string) || '';
  const description = (settings.alert_description as string) || '';
  const showDismiss = (settings.show_dismiss as string) !== 'no';
  const titleColor = resolveColor(settings.title_color, resolvedStyles, '#1a1a1a');
  const descColor = resolveColor(settings.description_color, resolvedStyles, '#555');
  const typeColors: Record<string, string> = { info: '#31708f', success: '#3c763d', warning: '#8a6d3b', danger: '#a94442' };
  const typeBgs: Record<string, string> = { info: '#d9edf7', success: '#dff0d8', warning: '#fcf8e3', danger: '#f2dede' };
  const borderColor = typeColors[type] || '#31708f';
  const bgColor = typeBgs[type] || '#d9edf7';
  return `<div class="elementor-alert elementor-alert-${esc(type)}" style="background-color:${bgColor};border-left:4px solid ${borderColor};border-radius:4px;padding:16px;position:relative;">
    ${title ? `<h5 class="elementor-alert-title" style="color:${titleColor};margin:0 0 8px;font-size:1.1rem;">${esc(title)}</h5>` : ''}
    ${description ? `<div class="elementor-alert-description" style="color:${descColor};font-size:0.95rem;">${esc(description)}</div>` : ''}
    ${showDismiss ? `<button class="elementor-alert-dismiss" style="position:absolute;top:8px;right:12px;background:none;border:none;font-size:1.25rem;cursor:pointer;color:${borderColor};">&times;</button>` : ''}
  </div>`;
}

function renderBackgroundOverlay(settings: Record<string, unknown>, resolvedStyles?: ResolvedStyles): string {
  const bg = settings.background_background;
  if (!bg || bg === 'none' || bg === '') return '';
  let overlay = '';
  const bgColor = resolvedStyles
    ? resolveSetting(settings, 'background_color', resolvedStyles)
    : (settings.background_color as string) || '';
  if (bgColor && bg !== 'video') {
    overlay += `<div class="elementor-background-overlay" style="background-color:${bgColor};"></div>`;
  }
  const bgImage = settings.background_image as { url?: string; id?: number } | undefined;
  if (bg === 'classic' && bgImage?.url) {
    const position = (settings.background_position as string) || 'center center';
    const repeat = (settings.background_repeat as string) || 'no-repeat';
    const size = (settings.background_size as string) || 'cover';
    overlay = `<div class="elementor-background-overlay" style="background-image:url(${esc(bgImage.url)});background-position:${position};background-repeat:${repeat};background-size:${size};"></div>${overlay}`;
  }
  // Video background with optional poster-image fallback
  if (bg === 'video') {
    const videoLink = (settings.background_video_link as string) || '';
    const videoStart = (settings.background_video_start as { size?: number })?.size ?? 0;
    const overlayImage = settings.background_video_fallback as { url?: string } | undefined;
    if (videoLink) {
      let videoUrl = videoLink;
      const ytMatch = videoLink.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\s]+)/);
      if (ytMatch) {
        videoUrl = `https://www.youtube.com/embed/${ytMatch[1]}?autoplay=1&mute=1&loop=1&playlist=${ytMatch[1]}&controls=0&start=${videoStart}`;
      }
      const poster = overlayImage?.url ? ` poster="${esc(overlayImage.url)}"` : '';
      overlay = `<div class="elementor-background-video-container">${ytMatch
        ? `<iframe src="${esc(videoUrl)}" class="elementor-background-video" frameborder="0" allow="autoplay;encrypted-media" allowfullscreen${poster}></iframe>`
        : `<video class="elementor-background-video" src="${esc(videoUrl)}" autoplay muted loop playsinline${poster}></video>`}</div>${overlay}`;
    }
  }
  const overlayType = settings.background_overlay_background as string;
  if (overlayType === 'classic') {
    const overlayColor = resolvedStyles
      ? resolveSetting(settings, 'background_overlay_color', resolvedStyles)
      : (settings.background_overlay_color as string) || '';
    if (overlayColor) {
      const opacity = (settings.background_overlay_opacity as { size?: number })?.size ?? 0.5;
      overlay += `<div class="elementor-background-overlay" style="background-color:${overlayColor};opacity:${opacity};"></div>`;
    }
  } else if (overlayType === 'gradient') {
    const overlayColor = resolvedStyles
      ? resolveSetting(settings, 'background_overlay_color', resolvedStyles)
      : (settings.background_overlay_color as string) || '';
    const overlayColor2 = resolvedStyles
      ? resolveSetting(settings, 'background_overlay_color_b', resolvedStyles)
      : (settings.background_overlay_color_b as string) || '';
    if (overlayColor && overlayColor2) {
      const gradType = (settings.background_overlay_gradient_type as string) || 'linear';
      const angle = ((settings.background_overlay_gradient_angle as { size?: number })?.size) ?? 180;
      const pos = (settings.background_overlay_gradient_position as string) || 'center center';
      const grad = gradType === 'radial'
        ? `radial-gradient(at ${pos}, ${overlayColor}, ${overlayColor2})`
        : `linear-gradient(${angle}deg, ${overlayColor}, ${overlayColor2})`;
      const opacity = (settings.background_overlay_opacity as { size?: number })?.size ?? 0.5;
      overlay += `<div class="elementor-background-overlay" style="background-image:${grad};opacity:${opacity};"></div>`;
    }
  }
  return overlay;
}

function renderShapeDivider(settings: Record<string, unknown>, position: 'top' | 'bottom'): string {
  const shape = settings[`shape_divider_${position}`] as string | undefined;
  if (!shape || shape === 'none' || shape === '') return '';
  const color = (settings[`shape_divider_${position}_color`] as string) || '#fff';
  const height = ((settings[`shape_divider_${position}_height`] as { size?: number })?.size) || 50;
  const flip = settings[`shape_divider_${position}_flip`] === 'yes';
  const negative = settings[`shape_divider_${position}_negative`] === 'yes';
  return `<div class="elementor-shape elementor-shape-${position}" data-negative="${negative ? 'true' : 'false'}">
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 100" preserveAspectRatio="none" style="height:${height}px;fill:${color};transform:${flip ? 'scaleX(-1)' : 'none'}">
      <path class="elementor-shape-fill" d="M500,10L0,0v90h1000V0L500,10z"/>
    </svg>
  </div>`;
}

function generateId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function getColumnSize(settings: Record<string, unknown>): number {
  const size = settings._column_size as number | undefined;
  if (!size) return 100;
  const sizes = [10, 11, 12, 14, 16, 20, 25, 30, 33, 40, 50, 60, 66, 70, 75, 80, 83, 90, 100];
  return sizes.reduce((prev, curr) => Math.abs(curr - size) < Math.abs(prev - size) ? curr : prev);
}

function renderSection(node: ElementorNode, resolvedStyles: ResolvedStyles): string {
  const settings = node.settings || {};
  const id = node.id || generateId('section');
  const classes: string[] = ['elementor-element', `elementor-element-${id}`, 'elementor-section'];
  const isInner = node.elements?.some(e => e.elType === 'column') || false;
  classes.push(isInner ? 'elementor-inner-section' : 'elementor-top-section');
  const layout = (settings.layout as string) || 'boxed';
  if (layout === 'full_width') classes.push('elementor-section-full_width');
  else classes.push('elementor-section-boxed');
  const height = (settings.height as string) || 'default';
  classes.push(`elementor-section-height-${height}`);
  if (settings.content_position) classes.push(`elementor-section-items-${settings.content_position}`);
  const gap = (settings.gap as string) || 'default';
  classes.push(`elementor-column-gap-${gap}`);
  if (settings.css_classes) classes.push(String(settings.css_classes));
  const customId = settings._element_id ? ` id="${esc(String(settings._element_id))}"` : '';
  const htmlTag = (settings.html_tag as string) || 'section';
  const bgOverlay = renderBackgroundOverlay(settings, resolvedStyles);
  const shapeTop = renderShapeDivider(settings, 'top');
  const shapeBottom = renderShapeDivider(settings, 'bottom');
  const children = node.elements || [];

  let sectionStyle = buildContainerStyle(settings, resolvedStyles);

  return `<${htmlTag} class="${classes.join(' ')}" data-id="${id}" data-element_type="section"${customId}${sectionStyle ? ` style="${sectionStyle}"` : ''}>
${bgOverlay}
${shapeTop}
<div class="elementor-container">
  ${children.map(c => renderNode(c, resolvedStyles)).join('\n')}
</div>
${shapeBottom}
</${htmlTag}>`;
}

function renderColumn(node: ElementorNode, resolvedStyles: ResolvedStyles): string {
  const settings = node.settings || {};
  const id = node.id || generateId('col');
  const size = getColumnSize(settings);
  const classes: string[] = ['elementor-element', `elementor-element-${id}`, 'elementor-column', `elementor-col-${size}`];
  const isInner = node.elements?.some(e => e.elType === 'column') || false;
  classes.push(isInner ? 'elementor-inner-column' : 'elementor-top-column');
  if (settings.css_classes) classes.push(String(settings.css_classes));
  const customId = settings._element_id ? ` id="${esc(String(settings._element_id))}"` : '';
  const children = node.elements || [];
  const hasChildren = children.length > 0;
  const colStyle = buildContainerStyle(settings, resolvedStyles);
  return `<div class="${classes.join(' ')}" data-id="${id}" data-element_type="column"${customId}${colStyle ? ` style="${colStyle}"` : ''}>
  <div class="elementor-widget-wrap${hasChildren ? ' elementor-element-populated' : ''}">
    ${children.map(c => renderNode(c, resolvedStyles)).join('\n')}
  </div>
</div>`;
}

function renderContainer(node: ElementorNode, resolvedStyles: ResolvedStyles): string {
  const settings = node.settings || {};
  const id = node.id || generateId('con');
  const classes: string[] = ['elementor-element', `elementor-element-${id}`, 'e-con'];
  if ((settings.content_width as string) === 'full') classes.push('e-con-full');
  else classes.push('e-con-boxed');
  const flexDir = (settings.flex_direction as string) || 'row';
  classes.push(`e-con-${flexDir}`);
  if (settings.css_classes) classes.push(String(settings.css_classes));
  if (settings._css_classes) classes.push(String(settings._css_classes));
  if (settings.content_position) classes.push(`e-con-${settings.content_position}`);
  const customId = settings._element_id ? ` id="${esc(String(settings._element_id))}"` : '';
  const children = node.elements || [];
  // Core fix: containers previously rendered with NO background/sizing styles.
  const conStyle = buildContainerStyle(settings, resolvedStyles);
  const bgOverlay = renderBackgroundOverlay(settings, resolvedStyles);
  return `<div class="${classes.join(' ')}" data-id="${id}" data-element_type="container"${customId}${conStyle ? ` style="${conStyle}"` : ''}>
  ${bgOverlay}
  ${children.map(c => renderNode(c, resolvedStyles)).join('\n')}
</div>`;
}

function renderWidget(node: ElementorNode, resolvedStyles: ResolvedStyles): string {
  const settings = node.settings || {};
  const id = node.id || generateId('widget');
  const widgetType = node.widgetType || 'html';
  const classes: string[] = ['elementor-element', `elementor-element-${id}`, 'elementor-widget', `elementor-widget-${widgetType}`];
  if (settings._css_classes) classes.push(String(settings._css_classes));
  const align = settings.align as string | undefined;
  if (align && align !== 'default') classes.push(`elementor-align-${align}`);
  const customId = settings._element_id ? ` id="${esc(String(settings._element_id))}"` : '';
  // Responsive hide
  const hideOn = settings.hide_on as string[] | undefined;
  if (Array.isArray(hideOn)) {
    hideOn.forEach(h => classes.push(`elementor-hidden-${h}`));
  }
  const widgetStyle = buildContainerStyle(settings, resolvedStyles);
  const hoverStyle = buildHoverContainerStyle(settings);
  const hoverAttr = hoverStyle ? ` onmouseover="this.style.cssText=this.dataset.sfNormal+';'+'${hoverStyle}'" onmouseout="this.style.cssText=this.dataset.sfNormal"` : '';
  const content = renderWidgetContent(node, resolvedStyles);
  return `<div class="${classes.join(' ')}" data-id="${id}" data-element_type="widget" data-widget_type="${widgetType}.default"${customId}${widgetStyle ? ` style="${widgetStyle}" data-sf-normal="${widgetStyle}"` : ''}${hoverAttr}>
  <div class="elementor-widget-container">
    ${content}
  </div>
</div>`;
}

function renderNode(node: ElementorNode, resolvedStyles: ResolvedStyles): string {
  if (!node) return '';
  switch (node.elType) {
    case 'section': return renderSection(node, resolvedStyles);
    case 'column': return renderColumn(node, resolvedStyles);
    case 'container': return renderContainer(node, resolvedStyles);
    case 'widget': return renderWidget(node, resolvedStyles);
    default: return '';
  }
}

export function renderElementorToHtml(
  elements: ElementorNode[],
  options?: { title?: string; brandTokens?: BrandTokens; globalKitPageSettings?: Record<string, unknown> }
): string {
  const brandTokens = options?.brandTokens;
  const kitStyles = extractKitStyles(elements, options?.globalKitPageSettings);
  const resolvedStyles = resolveKitStyles(kitStyles);

  const primary = resolvedStyles.colors.primary || brandTokens?.colors?.primary || '#3B82F6';
  const secondary = resolvedStyles.colors.secondary || brandTokens?.colors?.secondary || '#1e40af';
  const accent = resolvedStyles.colors.accent || brandTokens?.colors?.accent || '#06b6d4';
  const headingFont = resolvedStyles.defaultFonts.heading || brandTokens?.typography?.headingFont || 'system-ui, sans-serif';
  const bodyFont = resolvedStyles.defaultFonts.body || brandTokens?.typography?.bodyFont || 'system-ui, sans-serif';

  // Build a Google Fonts link from the kit's actual font families
  const kitFonts = new Set<string>();
  Object.values(resolvedStyles.typography).forEach(t => {
    if (t.fontFamily && !t.fontFamily.includes(',') && !t.fontFamily.includes(' ')) {
      kitFonts.add(t.fontFamily);
    }
  });
  if (headingFont && !headingFont.includes(',') && !headingFont.includes(' ')) kitFonts.add(headingFont);
  if (bodyFont && !bodyFont.includes(',') && !bodyFont.includes(' ')) kitFonts.add(bodyFont);
  kitFonts.add('Roboto');
  const googleFontsLink = `<link href="https://fonts.googleapis.com/css2?family=${Array.from(kitFonts).map(f => `${encodeURIComponent(f)}:wght@400;500;600;700`).join('&family=')}&display=swap" rel="stylesheet" />`;

  const body = elements.length > 0 ? `<div class="elementor elementor-page">
  <div class="elementor-section-wrap">
    ${elements.map(n => renderNode(n, resolvedStyles)).join('\n')}
  </div>
</div>` : `<div class="elementor elementor-page"><div class="elementor-section-wrap"><div style="padding:80px 24px;text-align:center;color:#666;font-size:1rem;">No content to preview yet.</div></div></div>`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${esc(options?.title || 'Website Preview')}</title>
${googleFontsLink}
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.2/css/all.min.css" />
<style>
  *, *::before, *::after { box-sizing: border-box; }
  body { margin: 0; padding: 0; font-family: ${bodyFont}, 'Roboto', sans-serif; line-height: 1.5; color: #333; background: #fff; }
  a { box-shadow: none; text-decoration: none; }
  img { height: auto; max-width: 100%; border: none; border-radius: 0; box-shadow: none; }
  hr { margin: 0; background-color: transparent; }
  embed, iframe, object, video { max-width: 100%; width: 100%; margin: 0; line-height: 1; border: none; }

  :root {
    --e-global-color-primary: ${primary};
    --e-global-color-secondary: ${secondary};
    --e-global-color-text: ${resolvedStyles.colors.text || '#7A7A7A'};
    --e-global-color-accent: ${accent};
    --e-global-typography-primary-font-family: ${resolvedStyles.typography.primary?.fontFamily || 'Roboto'};
    --e-global-typography-secondary-font-family: ${resolvedStyles.typography.secondary?.fontFamily || 'Roboto Slab'};
    --e-global-typography-text-font-family: ${resolvedStyles.typography.text?.fontFamily || 'Roboto'};
  }

  .elementor-section { position: relative; padding: 60px 24px; }
  .elementor-section .elementor-container { display: flex; margin-right: auto; margin-left: auto; position: relative; max-width: 1140px; flex-wrap: wrap; }
  .elementor-section.elementor-section-boxed > .elementor-container { max-width: 1140px; }
  .elementor-section.elementor-section-full_width > .elementor-container { max-width: 100%; }
  .elementor-section.elementor-section-items-top > .elementor-container { align-items: flex-start; }
  .elementor-section.elementor-section-items-middle > .elementor-container { align-items: center; }
  .elementor-section.elementor-section-items-bottom > .elementor-container { align-items: flex-end; }
  .elementor-section.elementor-section-height-full { min-height: 100vh; }

  .elementor-column { position: relative; min-height: 1px; display: flex; flex-direction: column; }
  .elementor-column-gap-default > .elementor-column > .elementor-element-populated { padding: 10px; }
  .elementor-column-gap-narrow > .elementor-column > .elementor-element-populated { padding: 5px; }
  .elementor-column-gap-extended > .elementor-column > .elementor-element-populated { padding: 15px; }
  .elementor-column-gap-wide > .elementor-column > .elementor-element-populated { padding: 20px; }
  .elementor-column-gap-wider > .elementor-column > .elementor-element-populated { padding: 30px; }
  .elementor-col-10 { width: 10%; } .elementor-col-11 { width: 11.111%; } .elementor-col-12 { width: 12.5%; }
  .elementor-col-14 { width: 14.285%; } .elementor-col-16 { width: 16.666%; } .elementor-col-20 { width: 20%; }
  .elementor-col-25 { width: 25%; } .elementor-col-30 { width: 30%; } .elementor-col-33 { width: 33.333%; }
  .elementor-col-40 { width: 40%; } .elementor-col-50 { width: 50%; } .elementor-col-60 { width: 60%; }
  .elementor-col-66 { width: 66.666%; } .elementor-col-70 { width: 70%; } .elementor-col-75 { width: 75%; }
  .elementor-col-80 { width: 80%; } .elementor-col-83 { width: 83.333%; } .elementor-col-90 { width: 90%; }
  .elementor-col-100 { width: 100%; }

  .elementor-widget { position: relative; width: 100%; }
  .elementor-widget:not(:last-child) { margin-bottom: 20px; }
  .elementor-widget-wrap { position: relative; width: 100%; flex-wrap: wrap; align-content: flex-start; display: flex; flex-direction: column; }
  .elementor-widget-wrap > .elementor-element { width: 100%; }
  .elementor-widget-container { transition: background 0.3s, border 0.3s, border-radius 0.3s, box-shadow 0.3s; }

  .elementor-heading-title { padding: 0; margin: 0; line-height: 1.2; font-family: ${headingFont}, 'Roboto', sans-serif; }
  .elementor-text-editor { font-family: ${bodyFont}, 'Roboto', sans-serif; line-height: 1.6; }
  .elementor-text-editor p:first-child { margin-top: 0; }
  .elementor-text-editor p:last-child { margin-bottom: 0; }

  .elementor-button { display: inline-block; line-height: 1; background-color: var(--e-global-color-primary, ${primary}); color: #fff; text-align: center; transition: all 0.3s; border-radius: 3px; padding: 12px 24px; font-size: 15px; font-family: ${bodyFont}, 'Roboto', sans-serif; text-decoration: none; cursor: pointer; border: none; }
  .elementor-button:hover { background-color: var(--e-global-color-secondary, ${secondary}); color: #fff; }
  .elementor-button-wrapper { margin: 10px 0; }
  .elementor-button-content-wrapper { display: flex; justify-content: center; align-items: center; gap: 8px; }
  .elementor-size-xs { font-size: 13px; padding: 10px 20px; border-radius: 2px; }
  .elementor-size-sm { font-size: 15px; padding: 12px 24px; border-radius: 3px; }
  .elementor-size-md { font-size: 16px; padding: 15px 30px; border-radius: 4px; }
  .elementor-size-lg { font-size: 18px; padding: 20px 40px; border-radius: 5px; }
  .elementor-size-xl { font-size: 20px; padding: 25px 50px; border-radius: 6px; }
  .elementor-align-left { text-align: left; }
  .elementor-align-center { text-align: center; }
  .elementor-align-right { text-align: right; }

  .elementor-spacer { height: 100%; }
  .elementor-spacer-inner { width: 100%; }
  .elementor-image { display: inline-block; }
  .elementor-image img { display: block; width: 100%; }

  .elementor-counter { display: flex; justify-content: center; align-items: stretch; flex-direction: column-reverse; }
  .elementor-counter-number-wrapper { flex: 1; display: flex; font-size: 69px; font-weight: 600; line-height: 1; text-align: center; }
  .elementor-counter-number { flex-grow: 1; }
  .elementor-counter-title { flex: 1; display: flex; justify-content: center; align-items: center; margin: 0; padding: 0; font-size: 19px; font-weight: 400; line-height: 2.5; }

  .elementor-image-box-wrapper { display: flex; flex-direction: column; text-align: center; width: 100%; }
  .elementor-image-box-img { display: inline-block; margin: 0 auto 15px; }
  .elementor-image-box-img img { display: block; width: 100%; height: 200px; object-fit: cover; border-radius: 12px; }
  .elementor-image-box-content { width: 100%; flex-grow: 1; }
  .elementor-image-box-title { margin: 0 0 8px; font-size: 1.25rem; font-weight: 600; }
  .elementor-image-box-description { margin: 0; font-size: 1rem; line-height: 1.6; }
  .elementor-image-box-wrapper.elementor-image-box-left { flex-direction: row; align-items: center; gap: 20px; text-align: left; }
  .elementor-image-box-wrapper.elementor-image-box-left .elementor-image-box-img { width: 120px; height: 120px; margin-bottom: 0; flex-shrink: 0; }

  .elementor-icon-box-wrapper { display: flex; flex-direction: column; text-align: center; }
  .elementor-icon-box-icon { display: inline-block; flex: 0 0 auto; line-height: 0; margin-bottom: 15px; }
  .elementor-icon-box-icon .elementor-icon { font-size: 50px; color: var(--e-global-color-primary, ${primary}); }
  .elementor-icon-box-content { width: 100%; flex-grow: 1; }
  .elementor-icon-box-title { margin: 0 0 8px; font-size: 1.25rem; font-weight: 600; }
  .elementor-icon-box-description { margin: 0; font-size: 1rem; line-height: 1.6; }
  .elementor-icon-box-wrapper.elementor-icon-box-left { flex-direction: row; text-align: left; gap: 16px; }
  .elementor-icon-box-wrapper.elementor-icon-box-left .elementor-icon-box-icon { margin-bottom: 0; }

  .elementor-icon-wrapper .elementor-icon { display: inline-block; line-height: 1; transition: all 0.2s; color: var(--e-global-color-primary, ${primary}); font-size: 50px; text-align: center; }
  .elementor-view-stacked .elementor-icon { padding: 0.5em; background-color: var(--e-global-color-primary, ${primary}); color: #fff; }
  .elementor-view-framed .elementor-icon { padding: 0.5em; color: var(--e-global-color-primary, ${primary}); border: 3px solid var(--e-global-color-primary, ${primary}); background-color: transparent; }
  .elementor-shape-circle .elementor-icon { border-radius: 50%; }

  .elementor-icon-list-items { list-style: none; padding: 0; margin: 0; }
  .elementor-icon-list-item { display: flex; align-items: center; gap: 12px; padding: 12px 0; border-bottom: 1px solid #f0f0f0; }
  .elementor-icon-list-item:last-child { border-bottom: none; }
  .elementor-icon-list-icon { color: var(--e-global-color-primary, ${primary}); font-size: 1.25rem; }

  .elementor-divider { display: flex; padding: 10px 0; }

  .elementor-wrapper { position: relative; width: 100%; }
  .elementor-video-container { position: relative; }
  .elementor-video { position: relative; padding-bottom: 56.25%; height: 0; overflow: hidden; }
  .elementor-video iframe { position: absolute; top: 0; left: 0; width: 100%; height: 100%; }

  .elementor-image-carousel-wrapper { overflow: hidden; }
  .elementor-image-carousel { display: flex; overflow-x: auto; gap: 16px; scroll-snap-type: x mandatory; scrollbar-width: none; }
  .elementor-image-carousel::-webkit-scrollbar { display: none; }
  .swiper-slide { flex-shrink: 0; width: 300px; scroll-snap-align: start; }
  .swiper-slide img { width: 100%; height: 200px; object-fit: cover; border-radius: 12px; }

  .elementor-progress-bar-wrapper { margin: 10px 0; }
  .elementor-progress-title { display: block; margin-bottom: 6px; font-weight: 600; }
  .elementor-progress-fill { transition: width 1s ease; border-radius: 2px; }
  .elementor-progress-percentage { display: block; text-align: right; font-size: 0.9rem; color: #666; margin-top: 4px; }

  .elementor-accordion { border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden; }
  .elementor-accordion-item { border-bottom: 1px solid #e5e7eb; }
  .elementor-accordion-item:last-child { border-bottom: none; }
  .elementor-tab-title { padding: 16px; background: #f9fafb; cursor: pointer; font-weight: 600; }
  .elementor-tab-title a { color: inherit; }
  .elementor-tab-content { padding: 16px; }

  .elementor-countdown-wrapper { display: flex; gap: 20px; justify-content: center; flex-wrap: wrap; }
  .elementor-countdown-item { text-align: center; min-width: 80px; }
  .elementor-countdown-number { display: block; font-size: 48px; font-weight: 700; line-height: 1; color: var(--e-global-color-primary, ${primary}); }
  .elementor-countdown-label { display: block; font-size: 14px; color: #666; margin-top: 8px; }

  .elementor-posts-container { display: grid; gap: 20px; }
  .elementor-posts-container .elementor-post { border: 1px solid #eee; border-radius: 8px; overflow: hidden; }
  .elementor-post h3 { margin: 0 0 8px; font-size: 1.1rem; }
  .elementor-post p { margin: 0; color: #666; font-size: 0.9rem; }

  .elementor-cta { border-radius: 8px; padding: 40px; text-align: center; color: #fff; }
  .elementor-cta__title { margin: 0 0 12px; }
  .elementor-cta__description { margin: 0 0 20px; }

  .elementor-blockquote { margin: 0; padding: 20px; border-left: 4px solid var(--e-global-color-primary, ${primary}); }
  .elementor-blockquote__content { font-style: italic; font-size: 1.1rem; line-height: 1.6; margin: 0 0 12px; }
  .elementor-blockquote__author { font-weight: 600; }

  .elementor-custom-embed iframe { width: 100%; min-height: 300px; }

  .elementor-form-wrapper { max-width: 500px; margin: 0 auto; }
  .elementor-form { display: flex; flex-direction: column; gap: 12px; }
  .elementor-form input, .elementor-form textarea { padding: 12px; border: 1px solid #d3d3d3; border-radius: 3px; font-size: 15px; font-family: inherit; }
  .elementor-form textarea { min-height: 100px; resize: vertical; }

  .elementor-slides-wrapper { position: relative; overflow: hidden; min-height: 500px; }
  .elementor-slide { display: none; flex-direction: column; align-items: center; justify-content: center; min-height: 500px; padding: 60px 40px; text-align: center; color: #fff; position: relative; }
  .elementor-slide.sf-active { display: flex; }
  .elementor-slide-heading { font-size: 2.5rem; margin: 0 0 16px; }
  .elementor-slide-description { font-size: 1.2rem; margin: 0 0 24px; max-width: 600px; }
  .sf-slide-arrow { position: absolute; top: 50%; transform: translateY(-50%); z-index: 10; background: rgba(0,0,0,0.3); color: #fff; border: none; font-size: 2rem; padding: 12px 16px; cursor: pointer; border-radius: 4px; transition: background 0.2s; }
  .sf-slide-arrow:hover { background: rgba(0,0,0,0.6); }
  .sf-slide-prev { left: 16px; }
  .sf-slide-next { right: 16px; }
  .sf-slide-dots { position: absolute; bottom: 20px; left: 50%; transform: translateX(-50%); display: flex; gap: 10px; z-index: 10; }
  .sf-slide-dot { width: 12px; height: 12px; border-radius: 50%; background: rgba(255,255,255,0.5); cursor: pointer; transition: background 0.2s; }
  .sf-slide-dot.sf-active { background: #fff; }
  .sf-slide-dot:hover { background: rgba(255,255,255,0.8); }

  .elementor-background-overlay { position: absolute; top: 0; left: 0; width: 100%; height: 100%; z-index: 1; pointer-events: none; }
  .elementor-section > .elementor-container { position: relative; z-index: 2; }
  .elementor-background-video-container { position: absolute; top: 0; left: 0; width: 100%; height: 100%; z-index: 0; overflow: hidden; }
  .elementor-background-video-container iframe, .elementor-background-video-container video { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 100%; height: 100%; object-fit: cover; pointer-events: none; }
  .elementor-shape { overflow: hidden; position: absolute; left: 0; width: 100%; line-height: 0; direction: ltr; z-index: 3; }
  .elementor-shape-top { top: -1px; }
  .elementor-shape-bottom { bottom: -1px; }
  .elementor-shape[data-negative="false"].elementor-shape-bottom, .elementor-shape[data-negative="true"].elementor-shape-top { transform: rotate(180deg); }
  .elementor-shape svg { display: block; width: calc(100% + 1.3px); position: relative; left: 50%; transform: translateX(-50%); }

  .elementor-metform { max-width: 500px; margin: 0 auto; padding: 24px; border: 1px solid #e5e7eb; border-radius: 8px; }
  .elementor-metform .elementor-form { display: flex; flex-direction: column; gap: 12px; }
  .elementor-metform input, .elementor-metform textarea { padding: 12px; border: 1px solid #d3d3d3; border-radius: 3px; }

  .sf-unsupported { padding: 12px 16px; margin: 4px 0; border: 1px dashed #cbd5e1; color: #94a3b8; font-size: 13px; font-family: monospace; background: #f8fafc; border-radius: 3px; }

  .elementor-testimonial { padding: 20px; }
  .elementor-testimonial__image img { width: 60px; height: 60px; border-radius: 50%; object-fit: cover; margin: 0 auto 12px; }
  .elementor-testimonial__content { font-style: italic; margin: 0 0 12px; font-size: 1.05rem; line-height: 1.6; }
  .elementor-testimonial__name { font-style: normal; font-weight: 600; }
  .elementor-testimonial__job { display: block; font-size: 0.9rem; color: #999; margin-top: 4px; }

  .elementor-star-rating { margin: 10px 0; }
  .elementor-star-rating__title { margin: 0 0 8px; font-weight: 600; }
  .elementor-star-rating__wrapper { display: flex; gap: 4px; }
  .elementor-star { transition: color 0.2s; }

  .elementor-rating { display: flex; gap: 4px; align-items: center; }

  .elementor-tabs { display: flex; flex-direction: column; }
  .elementor-tabs-horizontal .elementor-tabs-wrapper { display: flex; border-bottom: 2px solid #e5e7eb; }
  .elementor-tab-desktop-title { padding: 12px 20px; cursor: pointer; font-weight: 600; border-bottom: 2px solid transparent; margin-bottom: -2px; transition: all 0.2s; }
  .elementor-tab-desktop-title.elementor-active { border-bottom-color: var(--e-global-color-primary, ${primary}); color: var(--e-global-color-primary, ${primary}) !important; }
  .elementor-tabs-content-wrapper { padding: 16px 0; }
  .elementor-tabs-content-wrapper .elementor-tab-content { padding: 12px 0; line-height: 1.6; }

  .elementor-toggle { border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden; }
  .elementor-toggle-item { border-bottom: 1px solid #e5e7eb; }
  .elementor-toggle-item:last-child { border-bottom: none; }
  .elementor-toggle .elementor-tab-title { padding: 16px; background: #f9fafb; cursor: pointer; font-weight: 600; }
  .elementor-toggle .elementor-tab-title a { color: inherit; }
  .elementor-toggle .elementor-tab-content { padding: 16px; }

  .elementor-alert { position: relative; }
  .elementor-alert-title { margin: 0 0 8px; font-size: 1.1rem; }
  .elementor-alert-description { font-size: 0.95rem; }

  /* --- Container-level transitions --- */
  .elementor-element { transition: background 0.3s, border 0.3s, box-shadow 0.3s, opacity 0.3s; }

  /* --- Box shadow --- */
  .elementor-element { transition: box-shadow 0.3s; }

  /* --- Responsive hide --- */
  @media (max-width: 767px) { .elementor-hidden-mobile { display: none !important; } }
  @media (min-width: 768px) and (max-width: 1024px) { .elementor-hidden-tablet { display: none !important; } }
  @media (min-width: 1025px) { .elementor-hidden-desktop { display: none !important; } }

  /* --- Image hover animation --- */
  .elementor-image img { transition: transform 0.3s, filter 0.3s; }
  .elementor-image img:hover { transform: var(--sf-img-hover-scale, none); }

  /* --- Animations --- */
  @keyframes sf-fadeInUp { from { opacity: 0; transform: translateY(30px); } to { opacity: 1; transform: translateY(0); } }
  @keyframes sf-fadeIn { from { opacity: 0; } to { opacity: 1; } }
  @keyframes sf-slideInLeft { from { opacity: 0; transform: translateX(-40px); } to { opacity: 1; transform: translateX(0); } }
  @keyframes sf-slideInRight { from { opacity: 0; transform: translateX(40px); } to { opacity: 1; transform: translateX(0); } }
  @keyframes sf-countUp { from { opacity: 0; } to { opacity: 1; } }
  @keyframes sf-pulse { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.05); } }
  @keyframes sf-shimmer { 0% { background-position: -200% 0; } 100% { background-position: 200% 0; } }

  .elementor-section { animation: sf-fadeInUp 0.6s ease-out both; }
  .elementor-section:nth-child(2) { animation-delay: 0.1s; }
  .elementor-section:nth-child(3) { animation-delay: 0.2s; }
  .elementor-section:nth-child(4) { animation-delay: 0.3s; }
  .elementor-section:nth-child(5) { animation-delay: 0.4s; }

  .elementor-counter-number-animate { animation: sf-countUp 0.8s ease-out both; }
  .elementor-accordion-item { transition: all 0.3s ease; }

  @media (prefers-reduced-motion: reduce) {
    .elementor-section { animation: none; }
    .elementor-counter-number-animate { animation: none; }
  }

  @media (max-width: 1024px) {
    .elementor-col-10, .elementor-col-11, .elementor-col-12, .elementor-col-14, .elementor-col-16,
    .elementor-col-20, .elementor-col-25, .elementor-col-30, .elementor-col-33, .elementor-col-40,
    .elementor-col-50, .elementor-col-60, .elementor-col-66, .elementor-col-70, .elementor-col-75,
    .elementor-col-80, .elementor-col-83, .elementor-col-90, .elementor-col-100 { width: 100%; }
    .elementor-section { padding: 40px 16px; }
  }
  @media (max-width: 767px) {
    .elementor-column { width: 100% !important; }
  }

  .e-con { display: flex; flex-direction: row; flex-wrap: wrap; position: relative; min-width: 0; min-height: 0; }
  .e-con-boxed { max-width: 1140px; margin: 0 auto; width: 100%; }
  .e-con-full { width: 100%; }
  .e-con-row { flex-direction: row; }
  .e-con-column { flex-direction: column; }
</style>
</head>
<body>
${body}
<script>
(function() {
  // Counter count-up animation
  var counters = document.querySelectorAll('.elementor-counter-number[data-target]');
  counters.forEach(function(el) {
    var target = parseInt(el.getAttribute('data-target')) || 0;
    if (target === 0) return;
    var duration = 1200;
    var step = Math.max(1, Math.floor(target / 60));
    var current = 0;
    el.classList.add('elementor-counter-number-animate');
    function tick() {
      current += step;
      if (current >= target) { current = target; el.textContent = current; return; }
      el.textContent = current;
      requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  });

  // Accordion toggle
  var accordionTitles = document.querySelectorAll('.elementor-tab-title');
  accordionTitles.forEach(function(title) {
    title.addEventListener('click', function() {
      var content = this.nextElementSibling;
      var isOpen = content.style.display !== 'none';
      var parent = this.closest('.elementor-accordion');
      if (parent) {
        parent.querySelectorAll('.elementor-tab-content').forEach(function(c) { c.style.display = 'none'; });
        parent.querySelectorAll('.elementor-tab-title').forEach(function(t) { t.classList.remove('elementor-active'); });
      }
      if (!isOpen) {
        content.style.display = 'block';
        this.classList.add('elementor-active');
      }
    });
  });

  // --- Slide carousel (slides widget) ---
  function initSlideCarousel(wrapper) {
    var slides = wrapper.querySelectorAll('.elementor-slide');
    var dots = wrapper.querySelectorAll('.sf-slide-dot');
    var prev = wrapper.querySelector('.sf-slide-prev');
    var next = wrapper.querySelector('.sf-slide-next');
    var current = 0, total = slides.length;
    if (total === 0) return;
    function show(idx) {
      idx = (idx + total) % total;
      slides.forEach(function(s) { s.classList.remove('sf-active'); s.style.display = 'none'; });
      dots.forEach(function(d) { d.classList.remove('sf-active'); });
      slides[idx].classList.add('sf-active');
      slides[idx].style.display = 'flex';
      dots[idx].classList.add('sf-active');
      current = idx;
    }
    if (slides[0]) { slides[0].style.display = 'flex'; slides[0].classList.add('sf-active'); }
    if (next) next.addEventListener('click', function() { show(current + 1); });
    if (prev) prev.addEventListener('click', function() { show(current - 1); });
    dots.forEach(function(dot) {
      dot.addEventListener('click', function() { show(parseInt(this.getAttribute('data-slide'))); });
    });
    setInterval(function() { show(current + 1); }, 5000);
  }
  document.querySelectorAll('.sf-carousel').forEach(initSlideCarousel);

  // Image carousel with dots
  var imgCarousels = document.querySelectorAll('.elementor-image-carousel');
  imgCarousels.forEach(function(carousel) {
    var wrapper = carousel.closest('.sf-carousel');
    var imgDots = wrapper ? wrapper.querySelectorAll('.sf-img-dot') : [];
    if (imgDots.length) {
      imgDots.forEach(function(dot) {
        dot.addEventListener('click', function() {
          var idx = parseInt(this.getAttribute('data-slide'));
          var slideEl = carousel.querySelector('.swiper-slide[data-slide="' + idx + '"]');
          if (slideEl) slideEl.scrollIntoView({ behavior: 'smooth', inline: 'start', block: 'nearest' });
          imgDots.forEach(function(d) { d.classList.remove('sf-active'); });
          this.classList.add('sf-active');
        });
      });
      // Update active dot on scroll
      carousel.addEventListener('scroll', function() {
        var scrollLeft = this.scrollLeft;
        var slides = this.querySelectorAll('.swiper-slide');
        var activeIdx = 0;
        slides.forEach(function(s, idx) {
          var rect = s.getBoundingClientRect();
          var carouselRect = carousel.getBoundingClientRect();
          if (rect.left >= carouselRect.left && rect.left < carouselRect.left + carouselRect.width / 2) {
            activeIdx = idx;
          }
        });
        imgDots.forEach(function(d) { d.classList.remove('sf-active'); });
        if (imgDots[activeIdx]) imgDots[activeIdx].classList.add('sf-active');
      });
    }
    // Auto-play
    if (carousel.dataset.autoplay === 'false') return;
    var scrollAmount = carousel.clientWidth;
    setInterval(function() {
      var maxScroll = carousel.scrollWidth - carousel.clientWidth;
      var nextScroll = carousel.scrollLeft + scrollAmount;
      if (nextScroll >= maxScroll) { nextScroll = 0; }
      carousel.scrollTo({ left: nextScroll, behavior: 'smooth' });
    }, 4000);
  });

  // Tabs switching
  var tabTitles = document.querySelectorAll('.elementor-tab-desktop-title');
  tabTitles.forEach(function(title) {
    title.addEventListener('click', function() {
      var tab = parseInt(this.getAttribute('data-tab'));
      var parent = this.closest('.elementor-tabs');
      if (!parent) return;
      parent.querySelectorAll('.elementor-tab-desktop-title').forEach(function(t) { t.classList.remove('elementor-active'); });
      parent.querySelectorAll('.elementor-tab-content').forEach(function(c) { c.style.display = 'none'; c.classList.remove('elementor-active'); });
      this.classList.add('elementor-active');
      var content = parent.querySelector('.elementor-tab-content[data-tab="' + tab + '"]');
      if (content) { content.style.display = 'block'; content.classList.add('elementor-active'); }
    });
  });

  // Alert dismiss
  var dismissButtons = document.querySelectorAll('.elementor-alert-dismiss');
  dismissButtons.forEach(function(btn) {
    btn.addEventListener('click', function() {
      var alertEl = this.closest('.elementor-alert');
      if (alertEl) alertEl.style.display = 'none';
    });
  });
})();
</script>
</body>
</html>`;
}

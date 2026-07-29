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
import { prisma } from '@/lib/prisma';

type Viewport = 'desktop' | 'tablet' | 'mobile';

interface ElementorNode {
  id?: string;
  elType?: string;
  widgetType?: string;
  settings?: Record<string, unknown>;
  elements?: ElementorNode[];
  isInner?: boolean;
}

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
// Elementor DOM Replicator
// ============================================================================

function renderElementorTree(nodes: ElementorNode[], viewport: Viewport): string {
  if (!Array.isArray(nodes) || nodes.length === 0) return '';
  return `<div class="elementor elementor-page">
  <div class="elementor-section-wrap">
    ${nodes.map(n => renderNode(n, viewport, false)).join('\n')}
  </div>
</div>`;
}

function renderNode(node: ElementorNode, viewport: Viewport, isInner: boolean): string {
  if (!node) return '';
  switch (node.elType) {
    case 'section': return renderSection(node, viewport, isInner);
    case 'column': return renderColumn(node, viewport, isInner);
    case 'container': return renderContainer(node, viewport);
    case 'widget': return renderWidget(node, viewport);
    default: return '';
  }
}

function renderSection(node: ElementorNode, viewport: Viewport, isInner: boolean): string {
  const settings = node.settings || {};
  const id = node.id || generateId();
  const classes: string[] = [
    'elementor-element',
    `elementor-element-${id}`,
    'elementor-section',
    isInner ? 'elementor-inner-section' : 'elementor-top-section',
  ];
  const layout = settings.layout || 'boxed';
  if (layout === 'full_width') classes.push('elementor-section-full_width');
  else if (layout === 'boxed') classes.push('elementor-section-boxed');
  const height = settings.height || 'default';
  classes.push(`elementor-section-height-${height}`);
  if (settings.content_position) classes.push(`elementor-section-items-${settings.content_position}`);
  const columnGap = settings.gap || 'default';
  classes.push(`elementor-column-gap-${columnGap}`);
  if (settings.css_classes) classes.push(String(settings.css_classes));
  const customId = settings._element_id ? ` id="${escapeHtml(String(settings._element_id))}"` : '';
  const htmlTag = settings.html_tag || 'section';
  const bgOverlay = renderBackgroundOverlay(settings);
  const shapeTop = renderShapeDivider(settings, 'top');
  const shapeBottom = renderShapeDivider(settings, 'bottom');
  const children = node.elements || [];
  return `<${htmlTag} class="${classes.join(' ')}" data-id="${id}" data-element_type="section"${customId}>
${bgOverlay}
${shapeTop}
<div class="elementor-container">
  ${children.map(c => renderNode(c, viewport, isInner)).join('\n')}
</div>
${shapeBottom}
</${htmlTag}>`;
}

function renderColumn(node: ElementorNode, viewport: Viewport, isInner: boolean): string {
  const settings = node.settings || {};
  const id = node.id || generateId();
  const size = getColumnSize(settings, viewport);
  const classes: string[] = [
    'elementor-element',
    `elementor-element-${id}`,
    'elementor-column',
    `elementor-col-${size}`,
    isInner ? 'elementor-inner-column' : 'elementor-top-column',
  ];
  if (settings.css_classes) classes.push(String(settings.css_classes));
  const customId = settings._element_id ? ` id="${escapeHtml(String(settings._element_id))}"` : '';
  const children = node.elements || [];
  const hasChildren = children.length > 0;
  return `<div class="${classes.join(' ')}" data-id="${id}" data-element_type="column"${customId}>
  <div class="elementor-widget-wrap${hasChildren ? ' elementor-element-populated' : ''}">
    ${children.map(c => renderNode(c, viewport, isInner)).join('\n')}
  </div>
</div>`;
}

function renderContainer(node: ElementorNode, viewport: Viewport): string {
  const settings = node.settings || {};
  const id = node.id || generateId();
  const classes: string[] = ['elementor-element', `elementor-element-${id}`, 'e-con'];
  if (settings.content_width === 'full') classes.push('e-con-full');
  else classes.push('e-con-boxed');
  const flexDir = settings.flex_direction || 'row';
  classes.push(`e-con-${flexDir}`);
  if (settings.css_classes) classes.push(String(settings.css_classes));
  const customId = settings._element_id ? ` id="${escapeHtml(String(settings._element_id))}"` : '';
  const children = node.elements || [];
  return `<div class="${classes.join(' ')}" data-id="${id}" data-element_type="container"${customId}>
  ${children.map(c => renderNode(c, viewport, false)).join('\n')}
</div>`;
}

function renderWidget(node: ElementorNode, viewport: Viewport): string {
  const settings = node.settings || {};
  const id = node.id || generateId();
  const widgetType = node.widgetType || 'html';
  const classes: string[] = [
    'elementor-element',
    `elementor-element-${id}`,
    'elementor-widget',
    `elementor-widget-${widgetType}`,
  ];
  if (settings._css_classes) classes.push(String(settings._css_classes));
  const align = settings.align;
  if (align && align !== 'default') classes.push(`elementor-align-${align}`);
  const customId = settings._element_id ? ` id="${escapeHtml(String(settings._element_id))}"` : '';
  const content = renderWidgetContent(node, viewport);
  return `<div class="${classes.join(' ')}" data-id="${id}" data-element_type="widget" data-widget_type="${widgetType}.default"${customId}>
  <div class="elementor-widget-container">
    ${content}
  </div>
</div>`;
}

// ============================================================================
// Widget Content Renderers
// ============================================================================

function renderWidgetContent(node: ElementorNode, viewport: Viewport): string {
  const settings = node.settings || {};
  switch (node.widgetType) {
    case 'heading': return renderHeading(settings);
    case 'text-editor': return renderTextEditor(settings);
    case 'button': return renderButton(settings);
    case 'image': return renderImage(settings);
    case 'video': return renderVideo(settings);
    case 'divider': return renderDivider(settings);
    case 'spacer': return renderSpacer(settings);
    case 'icon': return renderIcon(settings);
    case 'icon-box': return renderIconBox(settings);
    case 'image-box': return renderImageBox(settings);
    case 'image-carousel': return renderImageCarousel(settings);
    case 'google_maps': return renderGoogleMaps(settings);
    case 'shortcode': return renderShortcode(settings);
    case 'html': return renderHtmlWidget(settings);
    case 'menu-anchor': return `<div id="${escapeHtml(String(settings.anchor || ''))}"></div>`;
    case 'sidebar': return `<div class="elementor-sidebar">${settings.sidebar || ''}</div>`;
    default: return `<div style="padding:20px;border:2px dashed #ddd;text-align:center;color:#999;"><small>Widget: ${node.widgetType}</small></div>`;
  }
}

function renderHeading(settings: Record<string, unknown>): string {
  const text = String(settings.heading || settings.title || '');
  const size = String(settings.header_size || settings.size || 'h2');
  const align = settings.align || 'left';
  const classes = ['elementor-heading-title', 'elementor-size-default'];
  if (settings.size) classes.push(`elementor-size-${settings.size}`);
  return `<${size} class="${classes.join(' ')}" style="text-align:${align}">
    ${text}
  </${size}>`;
}

function renderTextEditor(settings: Record<string, unknown>): string {
  const content = String(settings.editor || settings.wysiwyg || '');
  const align = settings.align || 'left';
  return `<div class="elementor-text-editor elementor-clearfix" style="text-align:${align}">
    ${content}
  </div>`;
}

function renderButton(settings: Record<string, unknown>): string {
  const text = String(settings.text || 'Click Here');
  const link = (settings.link as { url?: string })?.url || '#';
  const align = settings.align || 'left';
  const size = settings.size || 'md';
  const btnClasses = ['elementor-button', `elementor-size-${size}`];
  if (settings.button_type) btnClasses.push(`elementor-button-${settings.button_type}`);
  return `<div class="elementor-button-wrapper" style="text-align:${align}">
    <a href="${escapeHtml(link)}" class="${btnClasses.join(' ')}">
      <span class="elementor-button-content-wrapper">
        ${settings.icon ? `<span class="elementor-button-icon elementor-align-icon-left"><i class="${settings.icon}"></i></span>` : ''}
        <span class="elementor-button-text">${escapeHtml(text)}</span>
      </span>
    </a>
  </div>`;
}

function renderImage(settings: Record<string, unknown>): string {
  const img = settings.image as { url?: string; alt?: string; id?: number } | undefined;
  const url = img?.url || String(settings.image || '');
  const alt = img?.alt || String(settings.alt || '');
  const width = settings.image_size === 'custom' ? `${(settings.image_custom_dimension as any)?.width || 'auto'}px` : '100%';
  const link = (settings.link as { url?: string })?.url;
  const imgHtml = `<img decoding="async" width="${width}" src="${escapeHtml(url)}" class="attachment-large size-large" alt="${escapeHtml(alt)}" />`;
  if (link) return `<a href="${escapeHtml(link)}">${imgHtml}</a>`;
  return `<div class="elementor-image">${imgHtml}</div>`;
}

function renderVideo(settings: Record<string, unknown>): string {
  const source = String(settings.video_type || 'youtube');
  const url = String(settings.youtube_url || settings.vimeo_url || settings.dailymotion_url || settings.url || '');
  if (!url) return '';
  let embedUrl = url;
  if (source === 'youtube') {
    const match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\s]+)/);
    if (match) embedUrl = `https://www.youtube.com/embed/${match[1]}`;
  }
  return `<div class="elementor-wrapper elementor-open-lightbox">
    <div class="elementor-video">
      <iframe src="${escapeHtml(embedUrl)}" frameborder="0" allowfullscreen loading="lazy"></iframe>
    </div>
  </div>`;
}

function renderDivider(settings: Record<string, unknown>): string {
  const style = settings.divider_style || 'solid';
  const weight = (settings.weight as any)?.size || 1;
  const color = settings.color || '#000';
  return `<div class="elementor-divider">
    <span class="elementor-divider-separator" style="border-top-style:${style};border-top-width:${weight}px;border-top-color:${color}"></span>
  </div>`;
}

function renderSpacer(settings: Record<string, unknown>): string {
  const height = (settings.space as any)?.size || settings.space || 50;
  const unit = (settings.space as any)?.unit || 'px';
  return `<div class="elementor-spacer">
    <div class="elementor-spacer-inner" style="height:${height}${unit}"></div>
  </div>`;
}

function renderIcon(settings: Record<string, unknown>): string {
  const iconObj = settings.selected_icon as { value?: string; library?: string } | undefined;
  const iconValue = iconObj?.value || String(settings.icon || '★');
  const iconLibrary = iconObj?.library || 'fa';
  return `<div class="elementor-icon-wrapper">
    <div class="elementor-icon">
      <i class="${iconLibrary} ${iconValue}" aria-hidden="true"></i>
    </div>
  </div>`;
}

function renderIconBox(settings: Record<string, unknown>): string {
  const iconObj = settings.selected_icon as { value?: string; library?: string } | undefined;
  const iconValue = iconObj?.value || 'fa-star';
  const iconLibrary = iconObj?.library || 'fa';
  const title = String(settings.title_text || '');
  const description = String(settings.description_text || '');
  const position = settings.icon_position || 'top';
  return `<div class="elementor-icon-box-wrapper elementor-icon-box-${position}">
    <div class="elementor-icon-box-icon">
      <span class="elementor-icon elementor-animation-">
        <i class="${iconLibrary} ${iconValue}" aria-hidden="true"></i>
      </span>
    </div>
    <div class="elementor-icon-box-content">
      <h3 class="elementor-icon-box-title">${title}</h3>
      <p class="elementor-icon-box-description">${description}</p>
    </div>
  </div>`;
}

function renderImageBox(settings: Record<string, unknown>): string {
  const img = settings.image as { url?: string; alt?: string } | undefined;
  const url = img?.url || String(settings.image_url || '');
  const title = String(settings.title_text || '');
  const description = String(settings.description_text || '');
  const position = settings.image_position || 'top';
  return `<div class="elementor-image-box-wrapper elementor-image-box-${position}">
    <div class="elementor-image-box-img">
      <img src="${escapeHtml(url)}" alt="" />
    </div>
    <div class="elementor-image-box-content">
      <h3 class="elementor-image-box-title">${title}</h3>
      <p class="elementor-image-box-description">${description}</p>
    </div>
  </div>`;
}

function renderImageCarousel(settings: Record<string, unknown>): string {
  const slides = (settings.carousel || []) as Array<{ url?: string }>;
  return `<div class="elementor-image-carousel-wrapper">
    <div class="elementor-image-carousel">
      ${slides.map(s => `<div class="swiper-slide"><img src="${escapeHtml(s.url || '')}" /></div>`).join('')}
    </div>
  </div>`;
}

function renderGoogleMaps(settings: Record<string, unknown>): string {
  const address = encodeURIComponent(String(settings.address || ''));
  const zoom = (settings.zoom as any)?.size || 10;
  return `<div class="elementor-custom-embed">
    <iframe frameborder="0" scrolling="no" marginheight="0" marginwidth="0"
      src="https://maps.google.com/maps?q=${address}&t=m&z=${zoom}&output=embed&iwloc=near"
      title="${settings.address}" aria-label="${settings.address}"></iframe>
  </div>`;
}

function renderShortcode(settings: Record<string, unknown>): string {
  return `<div class="elementor-shortcode">${settings.shortcode || ''}</div>`;
}

function renderHtmlWidget(settings: Record<string, unknown>): string {
  return String(settings.html || '');
}

// ============================================================================
// Helpers
// ============================================================================

function renderBackgroundOverlay(settings: Record<string, unknown>): string {
  const bg = settings.background_background;
  if (!bg || bg === 'none') return '';
  let overlay = '';
  if (bg === 'classic' && settings.background_image) {
    const imgUrl = typeof settings.background_image === 'object' ? (settings.background_image as any).url : settings.background_image;
    if (imgUrl) {
      overlay += `<div class="elementor-background-holder">
        <div class="elementor-background" style="background-image:url(${escapeHtml(imgUrl)});background-size:cover;background-position:center;"></div>
      </div>`;
    }
  }
  if (settings.background_overlay_background === 'classic' && settings.background_overlay_color) {
    overlay += `<div class="elementor-background-overlay" style="background-color:${settings.background_overlay_color};opacity:${(settings.background_overlay_opacity as any)?.size || 0.5}"></div>`;
  }
  return overlay;
}

function renderShapeDivider(settings: Record<string, unknown>, position: 'top' | 'bottom'): string {
  const shape = settings[`shape_divider_${position}`];
  if (!shape || shape === 'none' || shape === '') return '';
  const color = settings[`shape_divider_${position}_color`] || '#fff';
  const height = (settings[`shape_divider_${position}_height`] as any)?.size || 50;
  const flip = settings[`shape_divider_${position}_flip`] === 'yes';
  const negative = settings[`shape_divider_${position}_negative`] === 'yes';
  return `<div class="elementor-shape elementor-shape-${position}" data-negative="${negative ? 'true' : 'false'}">
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 100" preserveAspectRatio="none" style="height:${height}px;fill:${color};transform:${flip ? 'scaleX(-1)' : 'none'}">
      <path class="elementor-shape-fill" d="M500,10L0,0v90h1000V0L500,10z"/>
    </svg>
  </div>`;
}

function getColumnSize(settings: Record<string, unknown>, viewport: Viewport): string {
  const size = settings._column_size as number | undefined;
  if (!size) return '100';
  const sizes = [10, 11, 12, 14, 16, 20, 25, 30, 33, 40, 50, 60, 66, 70, 75, 80, 83, 90, 100];
  const nearest = sizes.reduce((prev, curr) => Math.abs(curr - size) < Math.abs(prev - size) ? curr : prev);
  return String(nearest);
}

function generateId(): string {
  return Math.random().toString(36).substring(2, 10);
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// ============================================================================
// Critical Elementor CSS (Inline)
// ============================================================================

function getCriticalCSS(brandTokens?: PreviewOptions['brandTokens']): string {
  const primary = brandTokens?.colors?.primary || '#3B82F6';
  const secondary = brandTokens?.colors?.secondary || '#10B981';
  const headingFont = brandTokens?.typography?.headingFont || 'Inter, system-ui, sans-serif';
  const bodyFont = brandTokens?.typography?.bodyFont || 'Inter, system-ui, sans-serif';
  return `
/* === Elementor Base Reset === */
.elementor { -webkit-hyphens: manual; -ms-hyphens: manual; hyphens: manual; }
.elementor *, .elementor *::before, .elementor *::after { box-sizing: border-box; }
.elementor a { box-shadow: none; text-decoration: none; }
.elementor hr { margin: 0; background-color: transparent; }
.elementor img { height: auto; max-width: 100%; border: none; border-radius: 0; box-shadow: none; }
.elementor embed, .elementor iframe, .elementor object, .elementor video { max-width: 100%; width: 100%; margin: 0; line-height: 1; border: none; }

/* === Section Layout === */
.elementor-section { position: relative; }
.elementor-section .elementor-container { display: flex; margin-right: auto; margin-left: auto; position: relative; max-width: 1140px; }
.elementor-section.elementor-section-boxed > .elementor-container { max-width: 1140px; }
.elementor-section.elementor-section-full_width > .elementor-container { max-width: 100%; }
.elementor-section.elementor-section-items-top > .elementor-container { align-items: flex-start; }
.elementor-section.elementor-section-items-middle > .elementor-container { align-items: center; }
.elementor-section.elementor-section-items-bottom > .elementor-container { align-items: flex-end; }
.elementor-section.elementor-section-height-full { height: 100vh; }
.elementor-section.elementor-section-height-min-height { min-height: 400px; }

/* === Column Layout === */
.elementor-column { position: relative; min-height: 1px; display: flex; }
.elementor-column-gap-default > .elementor-column > .elementor-element-populated { padding: 10px; }
.elementor-column-gap-narrow > .elementor-column > .elementor-element-populated { padding: 5px; }
.elementor-column-gap-extended > .elementor-column > .elementor-element-populated { padding: 15px; }
.elementor-column-gap-wide > .elementor-column > .elementor-element-populated { padding: 20px; }
.elementor-column-gap-wider > .elementor-column > .elementor-element-populated { padding: 30px; }

/* Column widths */
.elementor-col-10 { width: 10%; } .elementor-col-11 { width: 11.111%; } .elementor-col-12 { width: 12.5%; }
.elementor-col-14 { width: 14.285%; } .elementor-col-16 { width: 16.666%; } .elementor-col-20 { width: 20%; }
.elementor-col-25 { width: 25%; } .elementor-col-30 { width: 30%; } .elementor-col-33 { width: 33.333%; }
.elementor-col-40 { width: 40%; } .elementor-col-50 { width: 50%; } .elementor-col-60 { width: 60%; }
.elementor-col-66 { width: 66.666%; } .elementor-col-70 { width: 70%; } .elementor-col-75 { width: 75%; }
.elementor-col-80 { width: 80%; } .elementor-col-83 { width: 83.333%; } .elementor-col-90 { width: 90%; }
.elementor-col-100 { width: 100%; }

/* === Widget Wrapper === */
.elementor-widget { position: relative; }
.elementor-widget:not(:last-child) { margin-bottom: 20px; }
.elementor-widget-wrap { position: relative; width: 100%; flex-wrap: wrap; align-content: flex-start; }
.elementor-widget-wrap > .elementor-element { width: 100%; }
.elementor-widget-container { transition: background 0.3s, border 0.3s, border-radius 0.3s, box-shadow 0.3s; }

/* === Widget Specific === */
.elementor-heading-title { padding: 0; margin: 0; line-height: 1.2; font-family: ${headingFont}; }
.elementor-text-editor { font-family: ${bodyFont}; line-height: 1.6; }
.elementor-button { display: inline-block; line-height: 1; background-color: ${primary}; color: #fff; fill: #fff; text-align: center; transition: all 0.3s; border-radius: 3px; padding: 12px 24px; font-size: 15px; font-family: ${bodyFont}; text-decoration: none; cursor: pointer; }
.elementor-button:hover { background-color: ${secondary}; }
.elementor-button-wrapper { text-align: center; }
.elementor-button-content-wrapper { display: flex; justify-content: center; align-items: center; gap: 8px; }
.elementor-button .elementor-button-text { display: inline-block; }
.elementor-button .elementor-button-icon { flex-grow: 0; order: 5; }
.elementor-divider { padding-top: 10px; padding-bottom: 10px; }
.elementor-divider .elementor-divider-separator { display: block; width: 100%; }
.elementor-spacer { height: 100%; }
.elementor-spacer-inner { height: 100%; }
.elementor-image img { display: block; width: 100%; }
.elementor-icon-box-wrapper { display: flex; text-align: left; flex-direction: column; }
.elementor-icon-box-icon { flex: 0 0 auto; margin-bottom: 15px; }
.elementor-icon-box-content { flex-grow: 1; }
.elementor-icon-box-title { margin: 0 0 10px; font-family: ${headingFont}; }
.elementor-icon-box-description { margin: 0; font-family: ${bodyFont}; color: #666; }
.elementor-image-box-wrapper { overflow: hidden; text-align: center; }
.elementor-image-box-img { margin-bottom: 15px; }
.elementor-image-box-title { margin: 0 0 10px; font-family: ${headingFont}; }
.elementor-image-box-description { margin: 0; font-family: ${bodyFont}; color: #666; }
.elementor-video { position: relative; padding-bottom: 56.25%; height: 0; overflow: hidden; }
.elementor-video iframe { position: absolute; top: 0; left: 0; width: 100%; height: 100%; }

/* === Background === */
.elementor-background-holder, .elementor-background { inset: 0; position: absolute; overflow: hidden; z-index: 0; }
.elementor-background-overlay { inset: 0; position: absolute; z-index: 1; }
.elementor-section > .elementor-container { position: relative; z-index: 2; }

/* === Shape Dividers === */
.elementor-shape { overflow: hidden; position: absolute; left: 0; width: 100%; line-height: 0; direction: ltr; z-index: 3; }
.elementor-shape-top { top: -1px; }
.elementor-shape-bottom { bottom: -1px; }
.elementor-shape[data-negative="false"].elementor-shape-bottom, .elementor-shape[data-negative="true"].elementor-shape-top { transform: rotate(180deg); }
.elementor-shape svg { display: block; width: calc(100% + 1.3px); position: relative; left: 50%; transform: translateX(-50%); }

/* === Responsive === */
@media (max-width: 1024px) {
  .elementor-section .elementor-container { flex-wrap: wrap; }
  .elementor-col-10, .elementor-col-11, .elementor-col-12, .elementor-col-14, .elementor-col-16, .elementor-col-20, .elementor-col-25, .elementor-col-30, .elementor-col-33, .elementor-col-40, .elementor-col-50, .elementor-col-60, .elementor-col-66, .elementor-col-70, .elementor-col-75, .elementor-col-80, .elementor-col-83, .elementor-col-90, .elementor-col-100 { width: 100%; }
}
@media (max-width: 767px) {
  .elementor-section .elementor-container { flex-wrap: wrap; }
  .elementor-column { width: 100% !important; }
}

/* === Container (Flexbox) === */
.e-con { display: flex; flex-direction: var(--flex-direction); flex-wrap: var(--flex-wrap); justify-content: var(--justify-content); align-items: var(--align-items); align-content: var(--align-content); gap: var(--gap); position: relative; min-width: 0; min-height: 0; }
.e-con-boxed { text-align: initial; gap: initial; flex-wrap: initial; padding-inline-start: 0; padding-inline-end: 0; padding-block-start: 0; padding-block-end: 0; }
.e-con-full { width: 100%; max-width: 100%; min-height: 100vh; }

/* === Global Colors === */
:root { --e-global-color-primary: ${primary}; --e-global-color-secondary: ${secondary}; --e-global-color-accent: ${brandTokens?.colors?.accent || primary}; --e-global-color-text: #333; --e-global-color-title: #1a1a1a; }
`;
}

// ============================================================================
// HTML Document Generator
// ============================================================================

function generatePreviewHtml(elementorData: ElementorNode[], viewport: Viewport, brandTokens?: PreviewOptions['brandTokens']): string {
  const content = renderElementorTree(elementorData, viewport);
  const css = getCriticalCSS(brandTokens);
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Preview</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">
  <style>
    *, *::before, *::after { box-sizing: border-box; }
    body { margin: 0; padding: 0; font-family: Inter, system-ui, sans-serif; line-height: 1.5; color: #333; background: #fff; }
    ${css}
  </style>
</head>
<body>
  ${content}
</body>
</html>`;
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
    const html = generatePreviewHtml(elementorData, 'desktop', brandTokens);
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

/**
 * Elementor JSON -> HTML renderer.
 *
 * generatePreview() has never actually rendered anything - it wrote a
 * fake, nonexistent image URL to Project.previewImage. This module is the
 * real thing: it walks the modified Elementor element tree for a project
 * and produces an actual HTML document, so "preview" means a live
 * rendered page instead of a broken <img> tag.
 *
 * Scope: supports the widget types this codebase actually creates/modifies
 * (heading, text-editor, image, button, icon, spacer) plus the structural
 * types (section, container, column). Elementor has a much larger widget
 * library (forms, sliders, third-party addons, etc.) - anything not
 * recognized here renders as a labeled placeholder block rather than
 * being silently dropped, so gaps are visible instead of invisible.
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

function esc(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function renderWidget(node: ElementorNode): string {
  const settings = node.settings || {};

  switch (node.widgetType) {
    case 'heading': {
      const text = (settings.heading as string) || (settings.title as string) || '';
      const tag = (settings.header_size as string) || 'h2';
      return `<${tag} class="sf-heading">${esc(text)}</${tag}>`;
    }
    case 'text-editor': {
      // Content here is already HTML (set as e.g. "<p>...</p>" by the modifier)
      const html = (settings.editor as string) || '';
      return `<div class="sf-text">${html}</div>`;
    }
    case 'image': {
      const image = settings.image as { url?: string } | undefined;
      const url = image?.url || '';
      if (!url) return '';
      return `<img class="sf-image" src="${esc(url)}" alt="" loading="lazy" />`;
    }
    case 'button': {
      const text = (settings.text as string) || 'Learn More';
      const link = settings.link as { url?: string } | undefined;
      const href = link?.url || '#';
      return `<a class="sf-button" href="${esc(href)}">${esc(text)}</a>`;
    }
    case 'icon': {
      return `<span class="sf-icon" aria-hidden="true"></span>`;
    }
    case 'spacer': {
      const height = (settings.space as { size?: number } | undefined)?.size || 20;
      return `<div class="sf-spacer" style="height:${Number(height)}px"></div>`;
    }
    default: {
      // Unknown/unsupported widget type - show it explicitly rather than
      // silently disappearing, so gaps in renderer coverage stay visible.
      return `<div class="sf-unsupported" data-widget="${esc(node.widgetType)}">[${esc(node.widgetType || 'widget')} not yet supported in preview]</div>`;
    }
  }
}

function renderNode(node: ElementorNode): string {
  const children = (node.elements || []).map(renderNode).join('\n');

  switch (node.elType) {
    case 'section':
      return `<section class="sf-section">${children}</section>`;
    case 'container':
      return `<div class="sf-container">${children}</div>`;
    case 'column':
      return `<div class="sf-column">${children}</div>`;
    case 'widget':
      return renderWidget(node);
    default:
      return children;
  }
}

export function renderElementorToHtml(
  elements: ElementorNode[],
  options?: { title?: string; brandTokens?: BrandTokens }
): string {
  const brandTokens = options?.brandTokens;
  const primary = brandTokens?.colors?.primary || '#2563eb';
  const headingFont = brandTokens?.typography?.headingFont || 'system-ui, sans-serif';
  const bodyFont = brandTokens?.typography?.bodyFont || 'system-ui, sans-serif';

  const body = elements.length
    ? elements.map(renderNode).join('\n')
    : `<div class="sf-empty">No content to preview yet.</div>`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${esc(options?.title || 'Website Preview')}</title>
<style>
  * { box-sizing: border-box; }
  body {
    margin: 0;
    font-family: ${bodyFont};
    color: #1a1a1a;
    line-height: 1.6;
  }
  .sf-section { padding: 48px 24px; }
  .sf-container { max-width: 1140px; margin: 0 auto; }
  .sf-column { display: inline-block; vertical-align: top; padding: 0 12px; }
  .sf-heading {
    font-family: ${headingFont};
    margin: 0 0 16px 0;
  }
  .sf-text { margin: 0 0 16px 0; }
  .sf-image { max-width: 100%; height: auto; display: block; margin-bottom: 16px; }
  .sf-button {
    display: inline-block;
    padding: 12px 28px;
    background: ${primary};
    color: #fff;
    text-decoration: none;
    border-radius: 6px;
    font-weight: 600;
    margin-bottom: 16px;
  }
  .sf-spacer { width: 100%; }
  .sf-unsupported {
    padding: 12px;
    margin-bottom: 16px;
    border: 1px dashed #cbd5e1;
    color: #64748b;
    font-size: 13px;
    font-family: monospace;
    background: #f8fafc;
  }
  .sf-empty {
    padding: 80px 24px;
    text-align: center;
    color: #94a3b8;
  }
</style>
</head>
<body>
${body}
</body>
</html>`;
}

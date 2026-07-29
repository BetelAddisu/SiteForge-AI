import { describe, it, expect } from 'vitest';
import { renderElementorToHtml } from './render';

/**
 * Widget coverage regression test.
 *
 * Every widget type that renderWidget() explicitly handles must produce
 * real HTML — never the sf-unsupported placeholder. This test catches
 * regressions where a handled widget is accidentally moved to the
 * default case (which was how every previous gap was found — by user
 * report instead of by automated check).
 */

const resolvedStyles = { colors: {}, typography: {}, kitColors: {}, kitTypography: {} } as any;

const HANDLED_WIDGET_TYPES = [
  'heading',
  'text-editor',
  'image',
  'button',
  'icon',
  'spacer',
  'counter',
  'image-box',
  'icon-box',
  'icon-list',
  'divider',
  'video',
  'elementskit-video',
  'image-carousel',
  'social-icons',
  'progress',
  'accordion',
  'elementskit-accordion',
  'elementskit-countdown-timer',
  'posts',
  'elementskit-blog-posts',
  'call-to-action',
  'blockquote',
  'google_maps',
  'form',
  'slides',
  'shortcode',
  'html',
  'menu-anchor',
  'sidebar',
  'metform',
];

function makeMinimalWidget(widgetType: string) {
  return [{
    id: 'test-root',
    elType: 'section' as const,
    elements: [{
      id: 'test-col',
      elType: 'column' as const,
      elements: [{
        id: `widget-${widgetType}`,
        elType: 'widget' as const,
        widgetType,
        settings: { heading: 'Test', text: 'Test', title: 'Test', title_text: 'Test' },
      }],
    }],
  }];
}

describe('renderWidget coverage', () => {
  HANDLED_WIDGET_TYPES.forEach(widgetType => {
    it(`renders ${widgetType} without sf-unsupported placeholder`, () => {
      const tree = makeMinimalWidget(widgetType) as any;
      const html = renderElementorToHtml(tree);

      // The sf-unsupported placeholder means the widget fell through
      // to the default case despite being explicitly handled above.
      expect(html).not.toContain('sf-unsupported');
      // It should actually produce some meaningful HTML for the widget
      expect(html).toContain('sf-');
    });
  });

  it('produces sf-unsupported for an unknown widget type', () => {
    const tree = makeMinimalWidget('some-unknown-addon-widget') as any;
    const html = renderElementorToHtml(tree);

    // Unknown widgets should show the placeholder to make gaps visible
    expect(html).toContain('sf-unsupported');
  });

  it('renders a full document with DOCTYPE when no title provided', () => {
    const tree = makeMinimalWidget('heading') as any;
    const html = renderElementorToHtml(tree);

    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('<title>');
  });

  it('renders the provided title in the document head', () => {
    const tree = makeMinimalWidget('heading') as any;
    const html = renderElementorToHtml(tree, { title: 'Custom Page Title' });

    expect(html).toContain('<title>Custom Page Title</title>');
  });

  it('includes CSS keyframe animations in the style block', () => {
    const tree = makeMinimalWidget('heading') as any;
    const html = renderElementorToHtml(tree);

    expect(html).toContain('@keyframes sf-fadeInUp');
    expect(html).toContain('@keyframes sf-countUp');
    expect(html).toContain('@keyframes sf-pulse');
  });

  it('includes interactive JavaScript for counters, accordions, and carousels', () => {
    const tree = makeMinimalWidget('heading') as any;
    const html = renderElementorToHtml(tree);

    expect(html).toContain('counter count-up');
    expect(html).toContain('Accordion toggle');
    expect(html).toContain('carousel auto-play');
  });

  it('reads per-widget typography_font_family from heading settings', () => {
    const tree = [{
      id: 'test-root',
      elType: 'section' as const,
      elements: [{
        id: 'test-col',
        elType: 'column' as const,
        elements: [{
          id: 'widget-heading',
          elType: 'widget' as const,
          widgetType: 'heading',
          settings: { heading: 'Test', typography_font_family: 'Georgia' },
        }],
      }],
    }] as any;
    const html = renderElementorToHtml(tree);

    // The inline style should contain the per-widget font family
    expect(html).toContain('font-family:Georgia');
  });
});

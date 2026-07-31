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
  'tabs',
  'star-rating',
  'rating',
  'testimonial',
  'testimonial-carousel',
  'media-carousel',
  'toggle',
  'alert',
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

  it('applies background styles to containers (elType: container)', () => {
    const tree = [{
      id: 'container-bg-test',
      elType: 'container' as const,
      settings: {
        background_background: 'classic',
        background_color: '#2E1922',
        padding: { unit: 'px', top: 40, right: 40, bottom: 40, left: 40 },
      },
      elements: [{
        id: 'container-child',
        elType: 'widget' as const,
        widgetType: 'heading',
        settings: { heading: 'Test' },
      }],
    }] as any;
    const html = renderElementorToHtml(tree);

    expect(html).toContain('background:#2E1922');
    expect(html).toContain('padding:40px');
  });

  it('resolves __globals__ color references in backgrounds', () => {
    const tree = [{
      id: 'container-globals-test',
      elType: 'section' as const,
      settings: {
        background_background: 'classic',
        background_color: '',
        __globals__: { background_color: 'globals/colors?id=primary' },
      },
      elements: [],
    }] as any;
    const html = renderElementorToHtml(tree, {
      globalKitPageSettings: {
        system_colors: [
          { _id: 'primary', title: 'Primary', color: '#7000FF' },
          { _id: 'secondary', title: 'Secondary', color: '#311073' },
          { _id: 'text', title: 'Text', color: '#FFFFFF' },
          { _id: 'accent', title: 'Accent', color: '#288FFF' },
        ],
      },
    });

    expect(html).toContain('background:#7000FF');
  });

  it('renders video backgrounds with a poster fallback', () => {
    const tree = [{
      id: 'container-video-test',
      elType: 'section' as const,
      settings: {
        background_background: 'video',
        background_video_link: 'https://www.youtube.com/watch?v=abc123',
        background_video_fallback: { url: 'https://example.com/poster.jpg' },
      },
      elements: [],
    }] as any;
    const html = renderElementorToHtml(tree);

    expect(html).toContain('elementor-background-video-container');
    expect(html).toContain('youtube.com/embed/abc123');
    expect(html).toContain('poster="https://example.com/poster.jpg"');
  });

  it('resolves Theme Styles __globals__ page_settings (body_color → white via custom color)', () => {
    const tree = [{
      id: 'theme-style-test',
      elType: 'section' as const,
      settings: {
        background_background: 'classic',
        background_color: '',
        __globals__: { background_color: 'globals/colors?id=text' },
      },
      elements: [],
    }] as any;
    const html = renderElementorToHtml(tree, {
      globalKitPageSettings: {
        system_colors: [
          { _id: 'primary', title: 'Primary', color: '#9D5EC5' },
          { _id: 'secondary', title: 'Secondary', color: '#6D31A3' },
          { _id: 'text', title: 'Black', color: '#160C1C' },
          { _id: 'accent', title: 'Accent', color: '#E2C5F1' },
        ],
        custom_colors: [
          { _id: 'e777cd9', title: 'White', color: '#FFFFFF' },
        ],
        __globals__: { body_color: 'globals/colors?id=e777cd9' },
        body_color: '#222831',
      },
    });

    expect(html).toContain('background:#160C1C');
  });

  it('applies border-radius to buttons (pill shape)', () => {
    const tree = [{
      id: 'btn-radius-test',
      elType: 'section' as const,
      elements: [{
        id: 'btn-col',
        elType: 'column' as const,
        elements: [{
          id: 'btn-widget',
          elType: 'widget' as const,
          widgetType: 'button',
          settings: {
            text: 'Learn More',
            border_radius: { unit: 'px', top: 50, right: 50, bottom: 50, left: 50, isLinked: '1' },
          },
        }],
      }],
    }] as any;
    const html = renderElementorToHtml(tree);

    expect(html).toContain('border-radius:50px 50px 50px 50px');
  });

  it('loads Font Awesome in the document head', () => {
    const tree = makeMinimalWidget('heading') as any;
    const html = renderElementorToHtml(tree);

    expect(html).toContain('font-awesome');
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

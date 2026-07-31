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
  'elementskit-testimonial',
  'elementskit-progressbar',
  'elementskit-lottie',
  'elementskit-heading',
  'elementskit-button',
  'elementskit-icon-box',
  'elementskit-image-box',
  'elementskit-funfact',
  'qi_addons_for_elementor_separator',
  'qi_addons_for_elementor_parallax_images',
  'qi_addons_for_elementor_text_marquee',
  'jkit_testimonials',
  'jkit_client_logo',
  'ekit-nav-menu',
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
      expect(html).not.toContain('not yet supported in preview');
      // It should actually produce some meaningful HTML for the widget
      expect(html).toContain('sf-');
    });
  });

  it('produces sf-unsupported for an unknown widget type', () => {
    const tree = [{
      id: 'test-root',
      elType: 'section' as const,
      elements: [{
        id: 'test-col',
        elType: 'column' as const,
        elements: [{
          id: 'widget-unknown',
          elType: 'widget' as const,
          widgetType: 'some-unknown-addon-widget',
          settings: {},
        }],
      }],
    }] as any;
    const html = renderElementorToHtml(tree);

    // Unknown widgets should show the placeholder to make gaps visible
    expect(html).toContain('not yet supported in preview');
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

    expect(html).toContain('Counter count-up');
    expect(html).toContain('Accordion toggle');
    expect(html).toContain('Auto-play');
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

    expect(html).toContain('background:#FFFFFF');
  });

  it('renders gradient background overlays with resolved __globals__ colors', () => {
    const tree = [{
      id: 'gradient-overlay-test',
      elType: 'section' as const,
      settings: {
        background_background: 'classic',
        background_color: '',
        background_overlay_background: 'gradient',
        background_overlay_color: '',
        background_overlay_color_b: '',
        background_overlay_opacity: { unit: 'px', size: 0.92 },
        __globals__: {
          background_color: 'globals/colors?id=text',
          background_overlay_color: 'globals/colors?id=979996f',
          background_overlay_color_b: 'globals/colors?id=text',
        },
      },
      elements: [],
    }] as any;
    const html = renderElementorToHtml(tree, {
      globalKitPageSettings: {
        system_colors: [
          { _id: 'primary', title: 'Primary', color: '#9D5EC5' },
          { _id: 'text', title: 'Black', color: '#160C1C' },
        ],
        custom_colors: [
          { _id: '979996f', title: 'Black 2', color: '#321743' },
        ],
      },
    });

    expect(html).toContain('background-image:linear-gradient(180deg, #321743, #160C1C)');
    expect(html).toContain('opacity:0.92');
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

  it('adds onerror fallback to image widgets for dead hotlinks', () => {
    const tree = [{
      id: 'img-fallback-test',
      elType: 'section' as const,
      elements: [{
        id: 'img-col',
        elType: 'column' as const,
        elements: [{
          id: 'img-widget',
          elType: 'widget' as const,
          widgetType: 'image',
          settings: {
            image: { url: 'https://site.sociolib.com/dead.jpg', alt: 'Broken' },
          },
        }],
      }],
    }] as any;
    const html = renderElementorToHtml(tree);

    expect(html).toContain('onerror=');
    expect(html).toContain('Image%20unavailable');
  });

  it('renders elementskit-lottie with the lottie-web library and data-path', () => {
    const tree = [{
      id: 'lottie-test',
      elType: 'section' as const,
      elements: [{
        id: 'lottie-col',
        elType: 'column' as const,
        elements: [{
          id: 'lottie-widget',
          elType: 'widget' as const,
          widgetType: 'elementskit-lottie',
          settings: {
            ekit_lottie_type: 'url',
            ekit_lottie_url: 'https://example.com/animation.json',
            ekit_lottie_autoplay: 'true',
            ekit_lottie_loop: 'true',
          },
        }],
      }],
    }] as any;
    const html = renderElementorToHtml(tree);

    expect(html).toContain('lottie-web');
    expect(html).toContain('data-path="https://example.com/animation.json"');
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

  it('renders elementskit-heading with {{focused}} highlight and separator', () => {
    const tree = [{
      id: 'test-root',
      elType: 'section' as const,
      elements: [{
        id: 'test-col',
        elType: 'column' as const,
        elements: [{
          id: 'widget-ekit-heading',
          elType: 'widget' as const,
          widgetType: 'elementskit-heading',
          settings: {
            ekit_heading_title: 'Grow your {{report}}',
            ekit_heading_show_seperator: 'yes',
            ekit_heading_seperator_position: 'after',
          },
        }],
      }],
    }] as any;
    const html = renderElementorToHtml(tree);

    expect(html).toContain('elementskit-highlight');
    expect(html).toContain('>report<');
    expect(html).toContain('ekit_heading_separetor_wraper');
  });

  it('renders elementskit-button with label and icon', () => {
    const tree = [{
      id: 'test-root',
      elType: 'section' as const,
      elements: [{
        id: 'test-col',
        elType: 'column' as const,
        elements: [{
          id: 'widget-ekit-btn',
          elType: 'widget' as const,
          widgetType: 'elementskit-button',
          settings: {
            ekit_btn_text: 'Get Started',
            ekit_btn_icons: { value: 'fa-arrow-right', library: 'fa-solid' },
            ekit_btn_icon_align: 'right',
          },
        }],
      }],
    }] as any;
    const html = renderElementorToHtml(tree);

    expect(html).toContain('elementskit-btn');
    expect(html).toContain('Get Started');
    expect(html).toContain('fa-arrow-right');
  });

  it('renders elementskit-funfact with a count-up number target', () => {
    const tree = [{
      id: 'test-root',
      elType: 'section' as const,
      elements: [{
        id: 'test-col',
        elType: 'column' as const,
        elements: [{
          id: 'widget-ekit-funfact',
          elType: 'widget' as const,
          widgetType: 'elementskit-funfact',
          settings: {
            ekit_funfact_number: 250,
            ekit_funfact_number_suffix: 'k',
            ekit_funfact_title_text: 'Clients',
          },
        }],
      }],
    }] as any;
    const html = renderElementorToHtml(tree);

    expect(html).toContain('number-percentage');
    expect(html).toContain('data-value="250"');
    expect(html).toContain('Clients');
  });

  it('renders qi_addons_for_elementor_separator with styled line', () => {
    const tree = [{
      id: 'test-root',
      elType: 'section' as const,
      elements: [{
        id: 'test-col',
        elType: 'column' as const,
        elements: [{
          id: 'widget-qi-sep',
          elType: 'widget' as const,
          widgetType: 'qi_addons_for_elementor_separator',
          settings: {
            separator_color: '#ff00ff',
            separator_width: { size: 120, unit: 'px' },
            position: 'center',
          },
        }],
      }],
    }] as any;
    const html = renderElementorToHtml(tree);

    expect(html).toContain('qodef-qi-separator');
    expect(html).toContain('qodef-m-line');
    expect(html).toContain('#ff00ff');
    expect(html).toContain('width:120px');
  });

  it('renders jkit_testimonials with profile, quote and rating', () => {
    const tree = [{
      id: 'test-root',
      elType: 'section' as const,
      elements: [{
        id: 'test-col',
        elType: 'column' as const,
        elements: [{
          id: 'widget-jkit-t',
          elType: 'widget' as const,
          widgetType: 'jkit_testimonials',
          settings: {
            sg_setting_quote: 'yes',
            sg_setting_quote_icon: { value: 'fa-quote-left', library: 'fa-solid' },
            sg_setting_rating: 'yes',
            sg_testimonials_list: [{
              _id: 'x1',
              sg_testimonials_list_client_name: 'Jane',
              sg_testimonials_list_designation: 'CEO',
              sg_testimonials_list_review: 'Great work!',
              sg_testimonials_list_rating: { size: 5 },
            }],
          },
        }],
      }],
    }] as any;
    const html = renderElementorToHtml(tree);

    expect(html).toContain('jkit-testimonials');
    expect(html).toContain('testimonial-item');
    expect(html).toContain('Jane');
    expect(html).toContain('fa-quote-left');
    expect(html).toContain('rating-stars');
  });
});

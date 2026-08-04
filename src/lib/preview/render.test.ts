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

  it('keeps structured system_colors authoritative over theme-style body_color', () => {
    // Some kits ship BOTH a system_colors array and flat theme-style fields.
    // The structured palette is what globals/colors?id=* resolves to, so the
    // flat body_color must NOT clobber the palette entry (a theme whose
    // body_color points at a custom white color must not turn "text" white).
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
    expect(html).not.toContain('background:#FFFFFF');
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

  it('does not force a dark text color on headings without an explicit color', () => {
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
          settings: { heading: 'Hello' },
        }],
      }],
    }] as any;
    const html = renderElementorToHtml(tree);

    // Heading with no explicit color must NOT carry a hardcoded dark color,
    // so it can inherit white text from a dark section background.
    expect(html).toContain('elementor-heading-title');
    expect(html).not.toContain('color:#1a1a1a');
    expect(html).not.toMatch(/elementor-heading-title[^>]*color:#666/);
  });

  it('adds white text color on a dark section so children inherit contrast', () => {
    const tree = [{
      id: 'test-root',
      elType: 'section' as const,
      settings: {
        background_background: 'classic',
        background_color: '#1a1a2e',
      },
      elements: [{
        id: 'test-col',
        elType: 'column' as const,
        elements: [{
          id: 'widget-heading',
          elType: 'widget' as const,
          widgetType: 'heading',
          settings: { heading: 'Hello' },
        }],
      }],
    }] as any;
    const html = renderElementorToHtml(tree);

    expect(html).toContain('background:#1a1a2e');
    expect(html).toContain('color:#ffffff');
  });

  it('adds dark text color on a light section background', () => {
    const tree = [{
      id: 'test-root',
      elType: 'section' as const,
      settings: {
        background_background: 'classic',
        background_color: '#f4f4f4',
      },
      elements: [],
    }] as any;
    const html = renderElementorToHtml(tree);

    expect(html).toContain('background:#f4f4f4');
    expect(html).toContain('color:#333333');
  });

  it('keeps an explicit heading color when the user sets one', () => {
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
          settings: { heading: 'Hello', title_color: '#ff5500' },
        }],
      }],
    }] as any;
    const html = renderElementorToHtml(tree);

    expect(html).toContain('color:#ff5500');
  });

  it('resolves a direct globals/colors ref stored in title_color', () => {
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
          settings: { heading: 'Hello', title_color: 'globals/colors?id=primary' },
        }],
      }],
    }] as any;
    const html = renderElementorToHtml(tree, {
      globalKitPageSettings: {
        system_colors: [
          { _id: 'primary', title: 'Primary', color: '#0EA5E9' },
        ],
      },
    });

    expect(html).toContain('color:#0EA5E9');
  });

  it('renders a fit_to_screen section with min-height:100vh', () => {
    const tree = [{
      id: 'fit-screen',
      elType: 'section' as const,
      settings: { height: 'fit_to_screen' },
      elements: [],
    }] as any;
    const html = renderElementorToHtml(tree);

    expect(html).toContain('elementor-section-height-fit_to_screen');
    expect(html).toContain('min-height:100vh');
  });

  it('renders a min_height section with its configured min-height value', () => {
    const tree = [{
      id: 'min-height',
      elType: 'section' as const,
      settings: {
        height: 'min_height',
        min_height: { unit: 'px', size: 600 },
      },
      elements: [],
    }] as any;
    const html = renderElementorToHtml(tree);

    expect(html).toContain('elementor-section-height-min_height');
    expect(html).toContain('min-height:600px');
  });

  it('applies column width from _inline_size when _column_size is absent', () => {
    const tree = [{
      id: 'inline-size-section',
      elType: 'section' as const,
      elements: [{
        id: 'inline-col',
        elType: 'column' as const,
        settings: { _inline_size: 50 },
        elements: [],
      }, {
        id: 'inline-col-2',
        elType: 'column' as const,
        settings: { _inline_size: '50%' },
        elements: [],
      }],
    }] as any;
    const html = renderElementorToHtml(tree);

    expect(html).toContain('elementor-column elementor-col-50');
    // Both 50% columns get the col-50 class (not collapsed to full width)
    expect(html.match(/elementor-column elementor-col-50/g)).toHaveLength(2);
  });

  it('does not apply the top-section default padding to inner sections', () => {
    const tree = [{
      id: 'outer',
      elType: 'section' as const,
      settings: {},
      elements: [{
        id: 'col',
        elType: 'column' as const,
        elements: [{
          id: 'inner',
          elType: 'section' as const,
          settings: {},
          elements: [],
        }],
      }],
    }] as any;
    const html = renderElementorToHtml(tree);

    // The top-level section (which contains a column) is still a TOP section
    expect(html).toContain('elementor-element-outer');
    expect(html).toMatch(/elementor-element-outer[^>]*elementor-top-section/);
    // The section nested inside the column's widget-wrap is an INNER section
    expect(html).toMatch(/elementor-element-inner[^>]*elementor-inner-section/);
    expect(html).toContain('.elementor-top-section { padding: 60px 24px; }');
    expect(html).toContain('.elementor-inner-section { padding: 0; }');
  });

  it('gives flex containers a default gap and natural-width widgets', () => {
    const tree = [{
      id: 'con',
      elType: 'container' as const,
      settings: { flex_direction: 'row' },
      elements: [{
        id: 'c1',
        elType: 'widget' as const,
        widgetType: 'heading',
        settings: { heading: 'One' },
      }, {
        id: 'c2',
        elType: 'widget' as const,
        widgetType: 'heading',
        settings: { heading: 'Two' },
      }],
    }] as any;
    const html = renderElementorToHtml(tree);

    expect(html).toContain('.e-con { display: flex; flex-direction: row; flex-wrap: wrap; position: relative; min-width: 0; min-height: 0; gap: var(--e-con-gap, 20px); }');
    expect(html).toContain('.e-con > .elementor-widget { width: auto; }');
  });

  it('applies justify-content/align-items from container settings', () => {
    const tree = [{
      id: 'con-align',
      elType: 'container' as const,
      settings: {
        flex_direction: 'row',
        justify_content: 'center',
        content_position: 'middle',
      },
      elements: [],
    }] as any;
    const html = renderElementorToHtml(tree);

    expect(html).toContain('justify-content:center');
    expect(html).toContain('align-items:center');
  });

  it('emits units on string dimensions (Elementor stores them as strings)', () => {
    const tree = [{
      id: 'string-dim',
      elType: 'section' as const,
      settings: {
        background_background: 'classic',
        background_color: '#0A0903',
        padding: { unit: 'px', top: '200', right: '0', bottom: '120', left: '0' },
        margin: { unit: 'px', top: '0', right: '0', bottom: '0', left: '0' },
        border_border: 'solid',
        border_width: { unit: 'px', top: '1', right: '0', bottom: '1', left: '0' },
      },
      elements: [],
    }] as any;
    const html = renderElementorToHtml(tree);

    expect(html).toContain('padding:200px 0px 120px 0px');
    expect(html).toContain('margin:0px 0px 0px 0px');
    expect(html).toContain('border:1px 0px 1px 0px solid');
    // No unitless dimension declarations anywhere
    expect(html).not.toMatch(/padding:\d+ \d+ \d+ \d+/);
  });

  it('does not let the background color overlay cover the background image', () => {
    const tree = [{
      id: 'img-bg',
      elType: 'container' as const,
      settings: {
        background_background: 'classic',
        background_color: '#0A0903',
        background_image: { url: 'https://example.com/hero.jpg', id: 1 },
        background_position: 'bottom center',
        background_size: 'cover',
      },
      elements: [],
    }] as any;
    const html = renderElementorToHtml(tree);

    expect(html).toContain('background-image:url(https://example.com/hero.jpg)');
    expect(html).toContain('background-position:bottom center');
    // The image overlay must be the only background-layer div; a solid color
    // overlay would sit on top and hide the image.
    expect((html.match(/elementor-background-overlay[^>]*background-image/g) || []).length).toBe(1);
    expect((html.match(/elementor-background-overlay[^>]*background-color:#0A0903;/g) || [])).toHaveLength(0);
  });

  it('renders background_overlay_image for classic overlays', () => {
    const tree = [{
      id: 'ov-img',
      elType: 'container' as const,
      settings: {
        background_background: 'classic',
        background_color: '#0A0903',
        background_overlay_background: 'classic',
        background_overlay_image: { url: 'https://example.com/texture.png', id: 2 },
        background_overlay_opacity: { unit: 'px', size: 0.18 },
      },
      elements: [],
    }] as any;
    const html = renderElementorToHtml(tree);

    expect(html).toContain('background-image:url(https://example.com/texture.png)');
    expect(html).toContain('opacity:0.18');
  });

  it('treats translucent 8-digit-hex backgrounds as non-solid for contrast', () => {
    const tree = [{
      id: 'alpha-bg',
      elType: 'container' as const,
      settings: {
        background_background: 'classic',
        background_color: '#FFFFFF14',
      },
      elements: [],
    }] as any;
    const html = renderElementorToHtml(tree);

    expect(html).toContain('background:#FFFFFF14');
    // No contrast color forced — text inherits from the parent instead.
    expect(html).not.toMatch(/color:#333333/);
  });

  it('uses the kit text color as the page body default', () => {
    const tree = [{
      id: 'body-color',
      elType: 'section' as const,
      settings: {},
      elements: [],
    }] as any;
    const html = renderElementorToHtml(tree, {
      globalKitPageSettings: {
        system_colors: [
          { _id: 'primary', title: 'Primary', color: '#FFFFFF' },
          { _id: 'secondary', title: 'Secondary', color: '#0A0903' },
          { _id: 'text', title: 'Text', color: '#A7A7A7' },
          { _id: 'accent', title: 'Accent', color: '#FF4F22' },
        ],
      },
    });

    expect(html).toContain('color: #A7A7A7');
  });

  it('resolves a dark kit secondary for global background references', () => {
    const tree = [{
      id: 'dark-kit',
      elType: 'container' as const,
      settings: {
        background_background: 'classic',
        background_color: '',
        __globals__: { background_color: 'globals/colors?id=secondary' },
      },
      elements: [],
    }] as any;
    const html = renderElementorToHtml(tree, {
      globalKitPageSettings: {
        system_colors: [
          { _id: 'primary', title: 'Primary', color: '#FFFFFF' },
          { _id: 'secondary', title: 'Secondary', color: '#0A0903' },
          { _id: 'text', title: 'Text', color: '#A7A7A7' },
          { _id: 'accent', title: 'Accent', color: '#FF4F22' },
        ],
        // Flat theme-style fields must NOT override the structured palette:
        // h2_color points at the kit's white primary but secondary stays dark.
        h2_color: '#FFFFFF',
      },
    });

    expect(html).toContain('background:#0A0903');
    expect(html).toContain('color:#ffffff');
  });
});

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
    expect(html).toContain('swiper-pagination-bullet');
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

  it('renders image widget at its configured percent width, not forced to 100%', () => {
    const tree = [{
      id: 'img-width-test',
      elType: 'section' as const,
      elements: [{
        id: 'img-col',
        elType: 'column' as const,
        elements: [{
          id: 'img-widget',
          elType: 'widget' as const,
          widgetType: 'image',
          settings: {
            image: { url: 'https://example.com/hero.jpg', alt: 'Hero' },
            width: { unit: '%', size: 87 },
            align: 'center',
          },
        }],
      }],
    }] as any;
    const html = renderElementorToHtml(tree);

    expect(html).toMatch(/class="elementor-image"[^>]*>[\s\S]*<img[^>]*style="[^"]*width:87%;/);
  });

  it('honors image_custom_dimension when image_size is custom', () => {
    const tree = [{
      id: 'img-custom-dim-test',
      elType: 'section' as const,
      elements: [{
        id: 'img-col',
        elType: 'column' as const,
        elements: [{
          id: 'img-widget',
          elType: 'widget' as const,
          widgetType: 'image',
          settings: {
            image: { url: 'https://example.com/p.jpg', alt: 'P' },
            image_size: 'custom',
            image_custom_dimension: { width: 640, height: 480 },
          },
        }],
      }],
    }] as any;
    const html = renderElementorToHtml(tree);

    expect(html).toContain('width:640px;');
    expect(html).toContain('height:480px;');
  });

  it('honors image_custom_dimension via the legacy image_size_type flag', () => {
    const tree = [{
      id: 'img-legacy-dim-test',
      elType: 'section' as const,
      elements: [{
        id: 'img-col',
        elType: 'column' as const,
        elements: [{
          id: 'img-widget',
          elType: 'widget' as const,
          widgetType: 'image',
          settings: {
            image: { url: 'https://example.com/p.jpg', alt: 'P' },
            image_size_type: 'custom',
            image_custom_dimension: { width: 300, height: 200 },
          },
        }],
      }],
    }] as any;
    const html = renderElementorToHtml(tree);

    expect(html).toContain('width:300px;');
    expect(html).toContain('height:200px;');
  });

  it('applies image_border_radius to image widget images', () => {
    const tree = [{
      id: 'img-radius-test',
      elType: 'section' as const,
      elements: [{
        id: 'img-col',
        elType: 'column' as const,
        elements: [{
          id: 'img-widget',
          elType: 'widget' as const,
          widgetType: 'image',
          settings: {
            image: { url: 'https://example.com/hero.jpg', alt: 'Hero' },
            image_border_radius: { unit: 'px', top: '32', right: '32', bottom: '32', left: '32', isLinked: true },
          },
        }],
      }],
    }] as any;
    const html = renderElementorToHtml(tree);

    expect(html).toContain('border-radius:32px 32px 32px 32px;');
  });

  it('sizes image-box images to image_size percent width', () => {
    const tree = [{
      id: 'ib-size-test',
      elType: 'section' as const,
      elements: [{
        id: 'ib-col',
        elType: 'column' as const,
        elements: [{
          id: 'ib-widget',
          elType: 'widget' as const,
          widgetType: 'image-box',
          settings: {
            image: { url: 'https://example.com/avatar.jpg', alt: 'Avatar' },
            title_text: 'Jane',
            description_text: 'Lead',
            image_size: { unit: '%', size: 20 },
            image_position: 'left',
            image_border_radius: { unit: 'px', size: 100 },
            image_space: { unit: 'px', size: 10 },
          },
        }],
      }],
    }] as any;
    const html = renderElementorToHtml(tree);

    expect(html).toContain('width:20%');
    expect(html).toContain('border-radius:100px');
    expect(html).toContain('margin-right:10px');
  });

  it('keeps image-box images full width by default and unstretched', () => {
    const tree = [{
      id: 'ib-default-test',
      elType: 'section' as const,
      elements: [{
        id: 'ib-col',
        elType: 'column' as const,
        elements: [{
          id: 'ib-widget',
          elType: 'widget' as const,
          widgetType: 'image-box',
          settings: {
            image: { url: 'https://example.com/logo.png', alt: 'Logo' },
            title_text: 'SEO',
            description_text: 'Grow',
          },
        }],
      }],
    }] as any;
    const html = renderElementorToHtml(tree);

    expect(html).toContain('width:100%;');
    expect(html).toContain('height:auto');
    // Must not be forced into a fixed height crop
    expect(html).not.toContain('height:200px');
    expect(html).not.toContain('object-fit:cover');
  });

  it('renders single-show carousel slides at full width', () => {
    const tree = [{
      id: 'car-single-test',
      elType: 'section' as const,
      elements: [{
        id: 'car-col',
        elType: 'column' as const,
        elements: [{
          id: 'car-widget',
          elType: 'widget' as const,
          widgetType: 'image-carousel',
          settings: {
            slides_to_show: 1,
            carousel: [
              { url: 'https://example.com/1.jpg', alt: '1' },
              { url: 'https://example.com/2.jpg', alt: '2' },
            ],
          },
        }],
      }],
    }] as any;
    const html = renderElementorToHtml(tree);

    const slideWidths = Array.from(html.matchAll(/class="swiper-slide"[^>]*style="width:([^"]+)"/g)).map(m => m[1]);
    expect(slideWidths).toHaveLength(2);
    expect(slideWidths.every(w => w === '100%')).toBe(true);
  });

  it('sizes multi-show carousel slides so they fit without overflow', () => {
    const tree = [{
      id: 'car-multi-test',
      elType: 'section' as const,
      elements: [{
        id: 'car-col',
        elType: 'column' as const,
        elements: [{
          id: 'car-widget',
          elType: 'widget' as const,
          widgetType: 'image-carousel',
          settings: {
            slides_to_show: 5,
            carousel: [
              { url: 'https://example.com/1.jpg', alt: '1' },
              { url: 'https://example.com/2.jpg', alt: '2' },
              { url: 'https://example.com/3.jpg', alt: '3' },
              { url: 'https://example.com/4.jpg', alt: '4' },
              { url: 'https://example.com/5.jpg', alt: '5' },
            ],
          },
        }],
      }],
    }] as any;
    const html = renderElementorToHtml(tree);

    expect(html).toMatch(/style="width:calc\(20% - 13px\)"/);
  });

  it('renders the slides widget with the first slide visible by default', () => {
    const tree = [{
      id: 'slides-visible-test',
      elType: 'section' as const,
      elements: [{
        id: 'slides-col',
        elType: 'column' as const,
        elements: [{
          id: 'slides-widget',
          elType: 'widget' as const,
          widgetType: 'slides',
          settings: {
            slides: [
              { heading: 'First', background_image: { url: 'https://example.com/1.jpg' } },
              { heading: 'Second', background_image: { url: 'https://example.com/2.jpg' } },
            ],
          },
        }],
      }],
    }] as any;
    const html = renderElementorToHtml(tree);

    // Slide 0 must be rendered visible before JS runs; others rely on the
    // Elementor swiper-shell markup (.swiper-slide hidden via CSS, .sf-active shown).
    expect(html).toMatch(/class="elementor-slides-wrapper elementor-main-swiper sf-carousel"[^>]*data-total="2"/);
    expect(html).toMatch(/class="elementor-repeater-item-0 swiper-slide sf-active"[^>]*data-slide="0"/);
    expect(html).toMatch(/class="elementor-repeater-item-1 swiper-slide"[^>]*data-slide="1"/);
  });

  it('sizes slides from slides_height instead of a hardcoded height', () => {
    const tree = [{
      id: 'slides-height-test',
      elType: 'section' as const,
      elements: [{
        id: 'slides-col',
        elType: 'column' as const,
        elements: [{
          id: 'slides-widget',
          elType: 'widget' as const,
          widgetType: 'slides',
          settings: {
            slides_height: { unit: 'px', size: 400 },
            slides: [{ heading: 'H', background_image: { url: 'https://example.com/1.jpg' } }],
          },
        }],
      }],
    }] as any;
    const html = renderElementorToHtml(tree);

    expect(html).toContain('height:400px');
    expect(html).not.toContain('height:500px');
  });

  it('honors per-slide background_size and position for slides', () => {
    const tree = [{
      id: 'slides-bg-test',
      elType: 'section' as const,
      elements: [{
        id: 'slides-col',
        elType: 'column' as const,
        elements: [{
          id: 'slides-widget',
          elType: 'widget' as const,
          widgetType: 'slides',
          settings: {
            slides: [{
              heading: 'H',
              background_image: { url: 'https://example.com/hero.jpg' },
              background_size: 'contain',
              horizontal_position: 'left',
              vertical_position: 'top',
            }],
          },
        }],
      }],
    }] as any;
    const html = renderElementorToHtml(tree);

    expect(html).toContain('background-size:contain');
    expect(html).toContain('background-position:left top');
  });

  it('renders the slides background overlay tint', () => {
    const tree = [{
      id: 'slides-overlay-test',
      elType: 'section' as const,
      elements: [{
        id: 'slides-col',
        elType: 'column' as const,
        elements: [{
          id: 'slides-widget',
          elType: 'widget' as const,
          widgetType: 'slides',
          settings: {
            slides: [{
              heading: 'H',
              background_image: { url: 'https://example.com/hero.jpg' },
              background_overlay: 'yes',
              background_overlay_color: 'rgba(0,0,0,0.5)',
            }],
          },
        }],
      }],
    }] as any;
    const html = renderElementorToHtml(tree);

    expect(html).toContain('class="elementor-background-overlay"');
    expect(html).toContain('background-color:rgba(0,0,0,0.5)');
  });

  it('keeps rich HTML in slides descriptions unescaped', () => {
    const tree = [{
      id: 'slides-html-test',
      elType: 'section' as const,
      elements: [{
        id: 'slides-col',
        elType: 'column' as const,
        elements: [{
          id: 'slides-widget',
          elType: 'widget' as const,
          widgetType: 'slides',
          settings: {
            slides: [{ heading: '1912', description: '<strong>Second generation</strong><br>Detail text.' }],
          },
        }],
      }],
    }] as any;
    const html = renderElementorToHtml(tree);

    expect(html).toContain('<strong>Second generation</strong>');
    expect(html).not.toContain('&lt;strong&gt;');
  });

  it('applies slides layout controls (align, content width, colors, autoplay off)', () => {
    const tree = [{
      id: 'slides-layout-test',
      elType: 'section' as const,
      elements: [{
        id: 'slides-col',
        elType: 'column' as const,
        elements: [{
          id: 'slides-widget',
          elType: 'widget' as const,
          widgetType: 'slides',
          settings: {
            slides_text_align: 'left',
            slides_horizontal_position: 'left',
            content_max_width: { unit: '%', size: 44 },
            slides_padding: { unit: '%', top: '10', right: '10', bottom: '10', left: '10', isLinked: true },
            heading_color: '#FFFFFF',
            description_color: '#F0F0F0',
            heading_typography_font_family: 'Prata',
            heading_typography_font_size: { unit: 'rem', size: 4 },
            arrows_color: '#000000',
            slides: [
              { heading: '1912', description: 'History', background_image: { url: 'https://example.com/h.jpg' } },
            ],
          },
        }],
      }],
    }] as any;
    const html = renderElementorToHtml(tree);

    expect(html).toContain('text-align:left');
    expect(html).toContain('max-width:44%');
    expect(html).toContain('color:#FFFFFF');
    expect(html).toContain('font-family:Prata');
    expect(html).toContain('font-size:4rem');
    expect(html).toContain('--sf-arrow-color:#000000');
    // autoplay unset -> wrapper carries no data-autoplay attribute
    expect(html).not.toMatch(/elementor-slides-wrapper[^>]*data-autoplay/);
  });

  it('enables autoplay only when the slides autoplay control is set', () => {
    const tree = [{
      id: 'slides-autoplay-test',
      elType: 'section' as const,
      elements: [{
        id: 'slides-col',
        elType: 'column' as const,
        elements: [{
          id: 'slides-widget',
          elType: 'widget' as const,
          widgetType: 'slides',
          settings: {
            autoplay: 'yes',
            slides: [{ heading: 'H', background_image: { url: 'https://example.com/1.jpg' } }],
          },
        }],
      }],
    }] as any;
    const html = renderElementorToHtml(tree);

    expect(html).toContain('data-autoplay="1"');
  });

  it('renders Elementor navigation arrows and pagination dots for multi-slide slideshows', () => {
    const tree = [{
      id: 'slides-nav-test',
      elType: 'section' as const,
      elements: [{
        id: 'slides-col',
        elType: 'column' as const,
        elements: [{
          id: 'slides-widget',
          elType: 'widget' as const,
          widgetType: 'slides',
          settings: {
            slides: [
              { heading: 'A', background_image: { url: 'https://example.com/a.jpg' } },
              { heading: 'B', background_image: { url: 'https://example.com/b.jpg' } },
            ],
          },
        }],
      }],
    }] as any;
    const html = renderElementorToHtml(tree);

    expect(html).toMatch(/class="elementor-swiper-button elementor-swiper-button-prev"[^>]*aria-label="Previous slide"><i class="eicon-chevron-left"/);
    expect(html).toMatch(/class="elementor-swiper-button elementor-swiper-button-next"[^>]*aria-label="Next slide"><i class="eicon-chevron-right"/);
    expect(html).toContain('<div class="swiper-pagination">');
    expect(html).toContain('class="swiper-pagination-bullet swiper-pagination-bullet-active"');
    expect(html).toMatch(/swiper-pagination-bullet(?! swiper-pagination-bullet-active)/);
  });

  it('omits navigation when the navigation control is none', () => {
    const tree = [{
      id: 'slides-navnone-test',
      elType: 'section' as const,
      elements: [{
        id: 'slides-col',
        elType: 'column' as const,
        elements: [{
          id: 'slides-widget',
          elType: 'widget' as const,
          widgetType: 'slides',
          settings: {
            navigation: 'none',
            slides: [
              { heading: 'A', background_image: { url: 'https://example.com/a.jpg' } },
              { heading: 'B', background_image: { url: 'https://example.com/b.jpg' } },
            ],
          },
        }],
      }],
    }] as any;
    const html = renderElementorToHtml(tree);

    expect(html).not.toContain('class="elementor-swiper-button');
    expect(html).not.toContain('class="swiper-pagination"');
  });

  it('adds ken-burns classes from per-slide background_ken_burns', () => {
    const tree = [{
      id: 'slides-kenburns-test',
      elType: 'section' as const,
      elements: [{
        id: 'slides-col',
        elType: 'column' as const,
        elements: [{
          id: 'slides-widget',
          elType: 'widget' as const,
          widgetType: 'slides',
          settings: {
            slides: [{
              heading: 'H',
              background_image: { url: 'https://example.com/hero.jpg' },
              background_ken_burns: 'yes',
              zoom_direction: 'out',
            }],
          },
        }],
      }],
    }] as any;
    const html = renderElementorToHtml(tree);

    expect(html).toMatch(/class="swiper-slide-bg elementor-ken-burns elementor-ken-burns--out"/);
  });

  it('uses slides_title_tag/slides_description_tag and links the button when link_click is button', () => {
    const tree = [{
      id: 'slides-tags-test',
      elType: 'section' as const,
      elements: [{
        id: 'slides-col',
        elType: 'column' as const,
        elements: [{
          id: 'slides-widget',
          elType: 'widget' as const,
          widgetType: 'slides',
          settings: {
            slides_title_tag: 'h2',
            slides_description_tag: 'p',
            button_size: 'lg',
            slides: [{
              heading: 'Title',
              description: 'Body',
              button_text: 'Learn more',
              link: { url: 'https://example.com/go' },
              link_click: 'button',
            }],
          },
        }],
      }],
    }] as any;
    const html = renderElementorToHtml(tree);

    expect(html).toContain('<h2 class="elementor-slide-heading"');
    expect(html).toContain('<p class="elementor-slide-description"');
    expect(html).toMatch(/<div class="swiper-slide-inner"/);
    expect(html).toMatch(/<a class="elementor-button elementor-slide-button elementor-size-lg" href="https:\/\/example\.com\/go"/);
  });

  it('wraps the whole slide in an anchor when link_click is slide', () => {
    const tree = [{
      id: 'slides-link-test',
      elType: 'section' as const,
      elements: [{
        id: 'slides-col',
        elType: 'column' as const,
        elements: [{
          id: 'slides-widget',
          elType: 'widget' as const,
          widgetType: 'slides',
          settings: {
            slides: [{
              heading: 'Title',
              button_text: 'Go',
              link: { url: 'https://example.com/whole' },
              link_click: 'slide',
            }],
          },
        }],
      }],
    }] as any;
    const html = renderElementorToHtml(tree);

    expect(html).toMatch(/<a class="swiper-slide-inner" href="https:\/\/example\.com\/whole"/);
    expect(html).toMatch(/<div class="elementor-button elementor-slide-button elementor-size-sm"/);
  });

  it('applies advanced _padding/_background/_border widget styles (card look)', () => {
    const tree = [{
      id: 'adv-style-test',
      elType: 'section' as const,
      elements: [{
        id: 'adv-col',
        elType: 'column' as const,
        elements: [{
          id: 'adv-widget',
          elType: 'widget' as const,
          widgetType: 'heading',
          settings: {
            heading: 'Card',
            _padding: { unit: 'px', top: '024', right: '032', bottom: '024', left: '032' },
            _background_background: 'classic',
            _background_color: '',
            _border_border: 'solid',
            _border_radius: { unit: 'px', top: '24', right: '24', bottom: '24', left: '24', isLinked: true },
            __globals__: { _background_color: 'globals/colors?id=primary' },
          },
        }],
      }],
    }] as any;
    const html = renderElementorToHtml(tree, {
      globalKitPageSettings: {
        system_colors: [{ _id: 'primary', title: 'Primary', color: '#7000FF' }],
      },
    });

    expect(html).toContain('padding:024px 032px 024px 032px;');
    expect(html).toContain('background:#7000FF');
    expect(html).toContain('border:1px solid #e5e7eb;');
    expect(html).toContain('border-radius:24px 24px 24px 24px');
  });

  it('does not blow out the layout for string-valued _padding (acatrade heading)', () => {
    const tree = [{
      id: 'pad-blowout-test',
      elType: 'section' as const,
      settings: {},
      elements: [{
        id: 'pad-col',
        elType: 'column' as const,
        elements: [{
          id: 'pad-widget',
          elType: 'widget' as const,
          widgetType: 'heading',
          settings: {
            heading: 'Helping businesses succeed worldwide',
            _padding: { unit: 'px', top: '0', right: '300', bottom: '0', left: '300' },
          },
        }],
      }],
    }] as any;
    const html = renderElementorToHtml(tree);

    expect(html).toContain('padding:0px 300px 0px 300px');
    // Widgets must be able to shrink inside flex containers so large padding
    // cannot overflow the viewport (flex min-width:auto bug).
    expect(html).toMatch(/\.elementor-widget\s*\{[^}]*min-width:\s*0/);
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

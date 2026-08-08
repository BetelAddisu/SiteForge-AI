import { describe, it, expect } from 'vitest';
import {
  parseTemplateDocument,
  getTemplateElements,
  getTemplateName,
  getTemplateType,
  toElementorTemplateFile,
  toElementorManifestTemplate,
  type ElementorDocument,
} from './template-document';

const sectionNode = { id: 's1', elType: 'section' as const, elements: [] };
const widgetNode = {
  id: 'w1',
  elType: 'widget',
  widgetType: 'heading',
  settings: { heading: 'Hello' },
};

describe('parseTemplateDocument', () => {
  it('accepts a bare element array', () => {
    const parsed = parseTemplateDocument([sectionNode, widgetNode]);
    expect(parsed.shape).toBe('element-array');
    expect(parsed.document.content).toEqual([sectionNode, widgetNode]);
    expect(parsed.document.version).toBeUndefined();
  });

  it('accepts an inner document where content is the element array (acatrade shape)', () => {
    const doc = {
      version: '0.4',
      title: 'Home',
      type: 'page',
      metadata: { template_type: 'single-page', wp_page_template: 'elementor_header_footer' },
      content: [sectionNode],
    };
    const parsed = parseTemplateDocument(doc);
    expect(parsed.shape).toBe('document');
    expect(parsed.document.version).toBe('0.4');
    expect(parsed.document.title).toBe('Home');
    expect(parsed.document.metadata?.template_type).toBe('single-page');
    expect(parsed.document.content).toEqual([sectionNode]);
  });

  it('accepts a kit wrapper whose content is the inner document (digicy/saras shape)', () => {
    const doc = {
      id: 'abc',
      name: 'Saras Wine',
      content: {
        version: '0.4',
        title: 'Who we are',
        type: 'page',
        metadata: { template_type: 'page' },
        page_settings: { hide_title: 'yes' },
        content: [sectionNode, widgetNode],
      },
    };
    const parsed = parseTemplateDocument(doc);
    expect(parsed.shape).toBe('kit-wrapper');
    expect(parsed.document.content).toEqual([sectionNode, widgetNode]);
    expect(parsed.document.page_settings?.hide_title).toBe('yes');
  });

  it('returns shape none for unrecognized payloads', () => {
    expect(parseTemplateDocument(null).shape).toBe('none');
    expect(parseTemplateDocument('nope').shape).toBe('none');
    expect(parseTemplateDocument({ foo: 1 }).shape).toBe('none');
    expect(parseTemplateDocument({ content: { foo: 1 } }).shape).toBe('none');
    // Empty array is still a valid (empty) element array
    expect(parseTemplateDocument([]).shape).toBe('element-array');
  });
});

describe('getTemplateElements', () => {
  it('extracts elements from any supported shape', () => {
    expect(getTemplateElements([widgetNode])).toEqual([widgetNode]);
    expect(getTemplateElements({ content: [sectionNode] })).toEqual([sectionNode]);
    expect(getTemplateElements({ content: { content: [widgetNode] } })).toEqual([widgetNode]);
    expect(getTemplateElements({ content: { content: [{ bad: true }] } })).toEqual([]);
    expect(getTemplateElements({ random: true })).toEqual([]);
  });
});

describe('getTemplateName', () => {
  it('prefers the page_title section setting', () => {
    const doc = {
      title: 'Home',
      content: {
        content: [{ id: 's1', elType: 'section', settings: { page_title: 'Our Story' } }],
      },
    };
    expect(getTemplateName(doc)).toBe('Our Story');
  });

  it('falls back to the document title', () => {
    expect(getTemplateName({ title: 'About us', content: [sectionNode] }, 'Fallback')).toBe('About us');
  });

  it('falls back to the provided fallback', () => {
    expect(getTemplateName({ random: true }, 'Fallback')).toBe('Fallback');
  });
});

describe('getTemplateType', () => {
  it('prefers metadata.template_type', () => {
    const doc = {
      type: 'page',
      metadata: { template_type: 'single-page' },
      content: [sectionNode],
    };
    expect(getTemplateType(doc)).toBe('single-page');
  });

  it('falls back to the document type', () => {
    expect(getTemplateType({ type: 'page', content: [sectionNode] })).toBe('page');
  });

  it('defaults to page', () => {
    expect(getTemplateType([sectionNode])).toBe('page');
  });
});

describe('toElementorTemplateFile', () => {
  it('emits the Elementor export data shape', () => {
    const doc: ElementorDocument = {
      version: '0.4',
      metadata: { template_type: 'page' },
      page_settings: { hide_title: 'yes' },
      content: [sectionNode],
    };
    expect(toElementorTemplateFile(doc)).toEqual({
      content: [sectionNode],
      page_settings: { hide_title: 'yes' },
      version: '0.4',
      metadata: { template_type: 'page' },
    });
  });

  it('omits empty optional sections', () => {
    expect(toElementorTemplateFile({ content: [] })).toEqual({ content: [] });
  });
});

describe('toElementorManifestTemplate', () => {
  it('emits the Elementor export summary shape with title and doc_type', () => {
    const doc: ElementorDocument = {
      title: 'About us',
      metadata: { template_type: 'single-page' },
      content: [sectionNode],
    };
    expect(toElementorManifestTemplate(doc, '42')).toEqual({
      id: '42',
      title: 'About us',
      doc_type: 'single-page',
    });
  });

  it('carries Theme-Builder conditions and location through', () => {
    const doc: ElementorDocument = {
      title: 'Header',
      metadata: {
        template_type: 'header',
        conditions: [['include', 'entire_site']],
        location: 'header',
      },
      content: [sectionNode],
    };
    expect(toElementorManifestTemplate(doc, '7')).toMatchObject({
      title: 'Header',
      doc_type: 'header',
      conditions: [['include', 'entire_site']],
      location: 'header',
    });
  });
});

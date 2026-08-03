import { describe, it, expect } from 'vitest';
import {
  extractBrandTokens,
  mergeBrandTokens,
  applyBrandToTree,
  createBrandFromProjectData,
  DEFAULT_TOKENS,
} from './index';
import type { ElementorNode } from '@/lib/elementor/parser';

describe('extractBrandTokens', () => {
  it('returns defaults when no global styles provided', () => {
    const tokens = extractBrandTokens(null);
    expect(tokens.colors.primary).toBe('#3B82F6');
    expect(tokens.typography.headingFont).toBe('Inter');
  });

  it('extracts colors from global styles', () => {
    const styles = {
      colors: {
        primary: { value: '#FF0000' },
        secondary: { value: '#00FF00' },
      },
    };
    const tokens = extractBrandTokens(styles as any);
    expect(tokens.colors.primary).toBe('#FF0000');
    expect(tokens.colors.secondary).toBe('#00FF00');
    // Unspecified values keep defaults
    expect(tokens.colors.background).toBe('#FFFFFF');
  });

  it('extracts typography from global styles', () => {
    const styles = {
      typography: {
        primary: { value: { font_family: 'Roboto' } },
        text: { value: { font_family: 'Open Sans' } },
      },
    };
    const tokens = extractBrandTokens(styles as any);
    expect(tokens.typography.headingFont).toBe('Roboto');
    expect(tokens.typography.bodyFont).toBe('Open Sans');
  });
});

describe('mergeBrandTokens', () => {
  it('user primary overrides template primary', () => {
    const template = { colors: { primary: { value: '#000000' } } };
    const merged = mergeBrandTokens(
      { colors: { primary: '#FFFFFF', secondary: '' } },
      template as any,
    );
    expect(merged.colors.primary).toBe('#FFFFFF');
  });

  it('does not drop template values not overridden by user', () => {
    const template = {
      colors: {
        primary: { value: '#000000' },
        secondary: { value: '#111111' },
      },
    };
    const merged = mergeBrandTokens(
      { colors: { primary: '#FF0000', secondary: '' } },
      template as any,
    );
    // User overrode primary
    expect(merged.colors.primary).toBe('#FF0000');
    // Template secondary must be preserved
    expect(merged.colors.secondary).toBe('#111111');
  });

  it('empty user values do not overwrite template values', () => {
    const template = { colors: { primary: { value: '#000000' } } };
    const merged = mergeBrandTokens(
      { colors: { primary: '' } } as any,
      template as any,
    );
    expect(merged.colors.primary).toBe('#000000');
  });
});

describe('applyBrandToTree', () => {
  function makeTree(): ElementorNode[] {
    return [{
      id: 's1',
      elType: 'section',
      elements: [{
        id: 'c1',
        elType: 'column',
        elements: [
          { id: 'h1', elType: 'widget', widgetType: 'heading', settings: {} },
          { id: 'b1', elType: 'widget', widgetType: 'button', settings: {} },
          { id: 't1', elType: 'widget', widgetType: 'text-editor', settings: {} },
          { id: 'c1', elType: 'widget', widgetType: 'counter', settings: {} },
          { id: 'p1', elType: 'widget', widgetType: 'progress', settings: {} },
          { id: 'ct1', elType: 'widget', widgetType: 'call-to-action', settings: {} },
          { id: 'ib1', elType: 'widget', widgetType: 'icon-box', settings: {} },
          { id: 'im1', elType: 'widget', widgetType: 'image-box', settings: {} },
          { id: 'd1', elType: 'widget', widgetType: 'divider', settings: {} },
          { id: 's1', elType: 'widget', widgetType: 'social-icons', settings: {} },
        ],
      }],
    }] as ElementorNode[];
  }

  it('applies primary color to heading and button', () => {
    const tree = makeTree();
    applyBrandToTree(tree, {
      colors: { primary: '#FF0000', secondary: '#00FF00', text: '#333333', background: '#FFFFFF' },
      typography: { headingFont: 'Roboto', bodyFont: 'Inter' },
    });

    const el = (i: number) => tree[0].elements![0].elements![i];

    expect(el(0).settings?.title_color).toBe('#FF0000');
    expect(el(0).settings?.typography_font_family).toBe('Roboto');
    expect(el(1).settings?.background_color).toBe('#FF0000');
  });

  it('applies typography to text-editor', () => {
    const tree = makeTree();
    applyBrandToTree(tree, {
      colors: { primary: '#000', secondary: '#000', text: '#666', background: '#fff' },
      typography: { headingFont: 'HeadingFont', bodyFont: 'BodyFont' },
    });

    expect(tree[0].elements![0].elements![2].settings?.typography_font_family).toBe('BodyFont');
  });

  it('applies brand to counter, progress, cta, icon-box, image-box, divider, social-icons', () => {
    const tree = makeTree();
    applyBrandToTree(tree, {
      colors: { primary: '#FF0000', secondary: '#00FF00', text: '#333333', background: '#FFFFFF' },
      typography: { headingFont: 'A', bodyFont: 'B' },
    });

    const el = (i: number) => tree[0].elements![0].elements![i];

    // counter: number_color = primary, title_color = text
    expect(el(3).settings?.number_color).toBe('#FF0000');
    expect(el(3).settings?.title_color).toBe('#333333');

    // progress: inner_color = primary, background_color = background
    expect(el(4).settings?.inner_color).toBe('#FF0000');
    expect(el(4).settings?.background_color).toBe('#FFFFFF');

    // call-to-action: background_color = primary
    expect(el(5).settings?.background_color).toBe('#FF0000');

    // icon-box: title_color = primary, description_color = text
    expect(el(6).settings?.title_color).toBe('#FF0000');
    expect(el(6).settings?.description_color).toBe('#333333');

    // image-box: title_color = primary, description_color = text
    expect(el(7).settings?.title_color).toBe('#FF0000');
    expect(el(7).settings?.description_color).toBe('#333333');

    // divider: color = primary
    expect(el(8).settings?.color).toBe('#FF0000');

    // social-icons: icon_color = primary
    expect(el(9).settings?.icon_color).toBe('#FF0000');
  });
});

describe('createBrandFromProjectData', () => {
  it('fills defaults for unspecified values', () => {
    const tokens = createBrandFromProjectData({});
    expect(tokens.colors.primary).toBe('#3B82F6');
    expect(tokens.typography.headingFont).toBe('Inter');
    expect(tokens.style).toBe('modern');
  });

  it('uses provided brand colors', () => {
    const tokens = createBrandFromProjectData({
      brandColors: { primary: '#123456', secondary: '#789ABC' },
    });
    expect(tokens.colors.primary).toBe('#123456');
    expect(tokens.colors.secondary).toBe('#789ABC');
  });
});

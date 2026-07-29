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
      { colors: { primary: '#FFFFFF' } },
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
      { colors: { primary: '#FF0000' } },
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
        ],
      }],
    }] as ElementorNode[];
  }

  it('applies primary color to heading and button', () => {
    const tree = makeTree();
    applyBrandToTree(tree, {
      colors: { primary: '#FF0000', secondary: '#00FF00' },
      typography: { headingFont: 'Roboto', bodyFont: 'Inter' },
    });

    const heading = tree[0].elements![0].elements![0];
    const button = tree[0].elements![0].elements![1];

    expect(heading.settings?.title_color).toBe('#FF0000');
    expect(heading.settings?.typography_font_family).toBe('Roboto');
    expect(button.settings?.background_color).toBe('#FF0000');
  });

  it('applies typography to text-editor', () => {
    const tree = makeTree();
    applyBrandToTree(tree, {
      colors: { primary: '#000', secondary: '#000' },
      typography: { headingFont: 'HeadingFont', bodyFont: 'BodyFont' },
    });

    const textEditor = tree[0].elements![0].elements![2];
    expect(textEditor.settings?.typography_font_family).toBe('BodyFont');
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

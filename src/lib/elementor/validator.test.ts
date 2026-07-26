import { describe, it, expect } from 'vitest';
import { validateElementorJson } from './validator';
import type { ElementorNode } from './parser';

/**
 * This validator is the gate between "modification ran" and "modification
 * is safe to publish" - it was previously called with a hardcoded empty
 * array regardless of the actual modified content, meaning it could never
 * fail. These tests cover the real checks it's supposed to perform.
 */

describe('validateElementorJson', () => {
  it('passes a well-formed tree', () => {
    const tree: ElementorNode[] = [
      {
        id: 'sec1',
        elType: 'section',
        elements: [
          {
            id: 'col1',
            elType: 'column',
            elements: [{ id: 'w1', elType: 'widget', widgetType: 'heading', settings: { heading: 'Hi' } }],
          },
        ],
      },
    ];
    const result = validateElementorJson(tree);
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it('fails when input is not an array', () => {
    const result = validateElementorJson({ not: 'an array' });
    expect(result.valid).toBe(false);
    expect(result.errors[0].type).toBe('invalid_format');
  });

  it('passes an empty array (nothing to validate, nothing invalid)', () => {
    const result = validateElementorJson([]);
    expect(result.valid).toBe(true);
  });

  it('fails a node missing a required id', () => {
    const tree = [{ elType: 'section', elements: [] }] as unknown as ElementorNode[];
    const result = validateElementorJson(tree);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.message.includes('id'))).toBe(true);
  });

  it('fails a node missing elType', () => {
    const tree = [{ id: 'x', elements: [] }] as unknown as ElementorNode[];
    const result = validateElementorJson(tree);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.message.includes('elType'))).toBe(true);
  });

  it('fails a node with an invalid elType value', () => {
    const tree = [{ id: 'x', elType: 'not-a-real-type', elements: [] }] as unknown as ElementorNode[];
    const result = validateElementorJson(tree);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.message.includes('Invalid elType'))).toBe(true);
  });

  it('fails a widget node missing widgetType', () => {
    const tree: ElementorNode[] = [{ id: 'x', elType: 'widget' }];
    const result = validateElementorJson(tree);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.message.includes('widgetType'))).toBe(true);
  });

  it('flags a deprecated widget as a warning, not a hard error', () => {
    const tree: ElementorNode[] = [{ id: 'x', elType: 'widget', widgetType: 'theme-panel' }];
    const result = validateElementorJson(tree);
    expect(result.valid).toBe(true);
    expect(result.warnings.some(w => w.type === 'deprecated')).toBe(true);
  });

  it('validates nested children recursively, not just the top level', () => {
    const tree: ElementorNode[] = [
      {
        id: 'sec1',
        elType: 'section',
        elements: [{ id: 'bad-widget', elType: 'widget' /* missing widgetType */ }],
      },
    ];
    const result = validateElementorJson(tree);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.nodeId === 'bad-widget')).toBe(true);
  });
});

import { describe, it, expect } from 'vitest';
import {
  findAllNodesByWidgetType,
  setNodeContent,
  applyModifications,
} from './modifier';
import type { ElementorNode } from './parser';

/**
 * These tests exist because this exact module was the source of two
 * separate real production bugs in this project:
 *  1. applyModifications() mutates its input in place and returns only a
 *     summary - a prior version of the pipeline stored that summary as if
 *     it were the modified content itself.
 *  2. findNode() only ever finds the FIRST match of a given widget type -
 *     a prior version of the pipeline used this to apply generated
 *     content, silently discarding everything past the first heading/
 *     paragraph/button on the page.
 * findAllNodesByWidgetType/setNodeContent were added specifically to fix
 * bug #2 - these tests lock in that they actually find every match, not
 * just the first, and that setNodeContent doesn't accidentally touch a
 * different widget type's settings key.
 */

function makeTree(): ElementorNode[] {
  return [
    {
      id: 'sec-1',
      elType: 'section',
      elements: [
        {
          id: 'col-1',
          elType: 'column',
          elements: [
            { id: 'h1', elType: 'widget', widgetType: 'heading', settings: { heading: 'Original Heading 1' } },
            { id: 'b1', elType: 'widget', widgetType: 'button', settings: { text: 'Original Button' } },
          ],
        },
      ],
    },
    {
      id: 'sec-2',
      elType: 'section',
      elements: [
        {
          id: 'col-2',
          elType: 'column',
          elements: [
            { id: 'h2', elType: 'widget', widgetType: 'heading', settings: { heading: 'Original Heading 2' } },
            { id: 't1', elType: 'widget', widgetType: 'text-editor', settings: { editor: '<p>Original text</p>' } },
          ],
        },
      ],
    },
  ];
}

describe('findAllNodesByWidgetType', () => {
  it('finds every matching widget across all sections, not just the first', () => {
    const tree = makeTree();
    const headings = findAllNodesByWidgetType(tree, 'heading');
    expect(headings).toHaveLength(2);
    expect(headings[0].id).toBe('h1');
    expect(headings[1].id).toBe('h2');
  });

  it('returns an empty array when no widgets of that type exist', () => {
    const tree = makeTree();
    expect(findAllNodesByWidgetType(tree, 'image')).toEqual([]);
  });

  it('finds widgets nested arbitrarily deep, not just at the top level', () => {
    const deep: ElementorNode[] = [
      {
        id: 'outer',
        elType: 'container',
        elements: [
          {
            id: 'inner',
            elType: 'container',
            elements: [{ id: 'deep-heading', elType: 'widget', widgetType: 'heading', settings: {} }],
          },
        ],
      },
    ];
    expect(findAllNodesByWidgetType(deep, 'heading')).toHaveLength(1);
  });
});

describe('setNodeContent', () => {
  it('sets the correct settings key for each widget type', () => {
    const heading: ElementorNode = { id: 'h', elType: 'widget', widgetType: 'heading', settings: {} };
    setNodeContent(heading, 'New Heading');
    expect(heading.settings?.heading).toBe('New Heading');

    const button: ElementorNode = { id: 'b', elType: 'widget', widgetType: 'button', settings: {} };
    setNodeContent(button, 'Click Me');
    expect(button.settings?.text).toBe('Click Me');

    const textEditor: ElementorNode = { id: 't', elType: 'widget', widgetType: 'text-editor', settings: {} };
    setNodeContent(textEditor, 'Some paragraph text');
    expect(textEditor.settings?.editor).toBe('<p>Some paragraph text</p>');
  });

  it('does not throw on an unrecognized widget type', () => {
    const unknown: ElementorNode = { id: 'u', elType: 'widget', widgetType: 'some-addon-widget', settings: {} };
    expect(() => setNodeContent(unknown, 'text')).not.toThrow();
  });
});

describe('applyModifications', () => {
  it('mutates the passed tree in place - the tree itself is the real output, not the return value', () => {
    const tree = makeTree();
    const result = applyModifications(tree, {
      elements: [{ type: 'modify', target: { nodeId: 'h1' }, changes: { heading: 'Changed!' } }],
    });

    expect(result.success).toBe(true);
    // The actual assertion that matters: the tree passed in was mutated.
    expect(tree[0].elements![0].elements![0].settings?.heading).toBe('Changed!');
  });

  it('fails clearly rather than silently succeeding when target is empty', () => {
    const tree = makeTree();
    const result = applyModifications(tree, {
      elements: [{ type: 'modify', target: {}, changes: { heading: 'Should not apply' } }],
    });

    // An empty target must not silently match anything - this is the exact
    // bug that caused generated content to never reach real templates.
    expect(result.success).toBe(false);
  });
});

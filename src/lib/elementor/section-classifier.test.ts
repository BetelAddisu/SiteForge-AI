import { describe, it, expect } from 'vitest';
import { classifySections } from './section-classifier';
import type { ElementorNode } from './parser';

/**
 * This module exists to fix a real bug: content used to be filled into
 * widgets by raw document position (Nth heading on the whole page), with
 * no idea which section it actually belonged to. These tests lock in that
 * classification is based on actual section content, not just position,
 * and that ambiguous sections are marked 'unknown' rather than guessed at.
 */

function section(id: string, headingText: string, extra: ElementorNode[] = []): ElementorNode {
  return {
    id,
    elType: 'section',
    elements: [
      {
        id: `${id}-col`,
        elType: 'column',
        elements: [
          { id: `${id}-heading`, elType: 'widget', widgetType: 'heading', settings: { heading: headingText } },
          ...extra,
        ],
      },
    ],
  };
}

describe('classifySections', () => {
  it('classifies a section as "about" based on its heading text', () => {
    const tree = [section('s1', 'Welcome'), section('s2', 'About Us - Our Story')];
    const result = classifySections(tree);
    expect(result[1].role).toBe('about');
  });

  it('classifies a section as "testimonials" based on its heading text', () => {
    const tree = [section('s1', 'Welcome'), section('s2', 'What Our Clients Say')];
    const result = classifySections(tree);
    expect(result[1].role).toBe('testimonials');
  });

  it('classifies a section as "contact" based on its heading text', () => {
    const tree = [section('s1', 'Welcome'), section('s2', 'Get In Touch')];
    const result = classifySections(tree);
    expect(result[1].role).toBe('contact');
  });

  it('falls back to treating the first section as hero when no keywords match', () => {
    const tree = [section('s1', 'Some Generic Heading'), section('s2', 'Another Generic One')];
    const result = classifySections(tree);
    expect(result[0].role).toBe('hero');
  });

  it('falls back to treating the last section as footer when no keywords match', () => {
    const tree = [
      section('s1', 'Some Generic Heading'),
      section('s2', 'Middle Section'),
      section('s3', 'Final Generic Section'),
    ];
    const result = classifySections(tree);
    expect(result[2].role).toBe('footer');
  });

  it('marks an ambiguous middle section as unknown rather than guessing', () => {
    const tree = [
      section('s1', 'Welcome to our site'),
      section('s2', 'Just Some Random Middle Content'),
      section('s3', 'Copyright 2026, all rights reserved'),
    ];
    const result = classifySections(tree);
    // Middle section has no keyword match and isn't first/last and doesn't
    // have 3+ repeated groups, so it should NOT be confidently classified.
    expect(result[1].role).toBe('unknown');
  });

  it('only classifies top-level section/container nodes, not nested widgets', () => {
    const tree = [section('s1', 'About Us')];
    const result = classifySections(tree);
    expect(result).toHaveLength(1);
  });

  it('returns an empty array for an empty tree', () => {
    expect(classifySections([])).toEqual([]);
  });
});

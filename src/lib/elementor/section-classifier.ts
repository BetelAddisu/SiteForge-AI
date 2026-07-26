/**
 * Classifies each top-level section/container in a template's Elementor
 * tree by semantic role (hero, about, services, testimonials, contact,
 * footer, or unknown), using the text content already inside that section.
 *
 * Why this exists: filling widgets by raw document order (Nth heading on
 * the page = Nth generated content item) has no idea which section a
 * widget belongs to. A template with an unusual number of sections, or
 * sections in a different order than expected, ends up with content in
 * the wrong place - a service description landing in the hero, an about
 * paragraph landing in a testimonial card, etc. Classifying sections first
 * means content only gets applied within the section it actually belongs
 * in, and sections we can't confidently classify are left completely
 * untouched rather than guessed at.
 *
 * This is heuristic, not a guarantee - unusual layouts (e.g. a single
 * mega-section containing everything, or sections with no recognizable
 * text yet) can still be misclassified or left as `unknown`. Widgets in
 * `unknown` sections are deliberately left alone rather than filled with
 * a best guess, since a wrong guess is worse than an unchanged section.
 */
import type { ElementorNode } from './parser';

export type SectionRole =
  | 'hero'
  | 'about'
  | 'services'
  | 'testimonials'
  | 'contact'
  | 'footer'
  | 'unknown';

export interface ClassifiedSection {
  node: ElementorNode;
  role: SectionRole;
  index: number;
}

const KEYWORD_PATTERNS: Array<{ role: SectionRole; pattern: RegExp }> = [
  { role: 'testimonials', pattern: /testimonial|what.{0,15}client|customer review|what people say|success stories/i },
  { role: 'services', pattern: /our services|what we (do|offer)|services we|solutions|what we provide|features/i },
  { role: 'about', pattern: /about us|who we are|our story|about our|our mission|why choose us/i },
  { role: 'contact', pattern: /contact us|get in touch|reach (us|out)|send (us )?a message|our location|find us/i },
  { role: 'footer', pattern: /all rights reserved|copyright|©|privacy policy|terms of (service|use)/i },
];

function collectText(node: ElementorNode): string {
  const parts: string[] = [];
  const settings = node.settings || {};

  if (node.elType === 'widget') {
    if (typeof settings.heading === 'string') parts.push(settings.heading);
    if (typeof settings.title === 'string') parts.push(settings.title);
    if (typeof settings.editor === 'string') parts.push(settings.editor);
    if (typeof settings.text === 'string') parts.push(settings.text);
  }

  for (const child of node.elements || []) {
    parts.push(collectText(child));
  }

  return parts.join(' ');
}

/**
 * Count widgets by type within a section - used as a secondary signal
 * (e.g. several repeated image+heading+text groups strongly suggests a
 * services/features grid even without matching keywords).
 */
function countRepeatedGroups(node: ElementorNode): number {
  const columns = (node.elements || []).filter(el => el.elType === 'column' || el.elType === 'container');
  return columns.length;
}

export function classifySections(nodes: ElementorNode[]): ClassifiedSection[] {
  // Only top-level section/container nodes are classified - these are the
  // page's actual visual sections. Widgets are matched/filled within
  // whichever section they belong to, not classified individually.
  const topLevel = nodes.filter(n => n.elType === 'section' || n.elType === 'container');

  return topLevel.map((node, index) => {
    const text = collectText(node).toLowerCase();

    for (const { role, pattern } of KEYWORD_PATTERNS) {
      if (pattern.test(text)) {
        return { node, role, index };
      }
    }

    // No keyword match - fall back to position + structural heuristics.
    // Structural signal comes first: a section with several repeated
    // column/card groups is a strong services/features signal regardless
    // of position, and should win over "it's the last section" - a
    // services grid that happens to be the last section on the page
    // should not be mislabeled as a footer.
    if (countRepeatedGroups(node) >= 3) {
      return { node, role: 'services', index };
    }
    if (index === 0) {
      return { node, role: 'hero', index };
    }
    if (index === topLevel.length - 1) {
      return { node, role: 'footer', index };
    }

    return { node, role: 'unknown', index };
  });
}

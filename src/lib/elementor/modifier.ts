/**
 * Elementor JSON Modifier
 * 
 * Phase 8: Atomic modification with validation.
 * 
 * Capabilities:
 * - Replace: headings, paragraphs, buttons, images, links, colors, fonts
 * - Modify: sections, containers, widget settings
 * - Bespoke handlers for each widget type
 */

import type { ElementorNode } from './parser';

// ============================================================================
// Types
// ============================================================================

export interface Modification {
  type: 'replace' | 'modify' | 'delete';
  target: {
    nodeId?: string;
    widgetType?: string;
    path?: string[];
  };
  changes: Record<string, unknown>;
}

export interface ModificationResult {
  success: boolean;
  modified: boolean;
  modifications: string[];
  error?: string;
}

export interface ModificationBatch {
  elements: Modification[];
}

// ============================================================================
// Modification Functions
// ============================================================================

/**
 * Apply a batch of modifications to Elementor JSON
 */
export function applyModifications(
  nodes: ElementorNode[],
  batch: ModificationBatch
): ModificationResult {
  const modifications: string[] = [];
  
  for (const mod of batch.elements) {
    const result = applySingleModification(nodes, mod);
    if (result.modified) {
      modifications.push(...result.modifications);
    }
    if (!result.success) {
      return result;
    }
  }
  
  return {
    success: true,
    modified: modifications.length > 0,
    modifications,
  };
}

/**
 * Apply a single modification
 */
function applySingleModification(
  nodes: ElementorNode[],
  modification: Modification
): ModificationResult {
  // Find target node
  const target = findNode(nodes, modification.target);
  
  if (!target) {
    return {
      success: false,
      modified: false,
      modifications: [],
      error: `Target not found: ${JSON.stringify(modification.target)}`,
    };
  }
  
  // Apply changes
  if (modification.type === 'replace') {
    return replaceInNode(target, modification.changes);
  } else if (modification.type === 'modify') {
    return modifyNode(target, modification.changes);
  }
  
  return {
    success: true,
    modified: false,
    modifications: [],
  };
}

/**
 * Find every node of a given widget type, in document order.
 *
 * The single-target functions above (replaceHeading, replaceParagraph, etc.)
 * only ever touch the FIRST matching widget in the whole tree via findNode.
 * Real templates typically have many headings/text blocks/buttons across
 * hero/about/services/testimonials/footer sections - using only the
 * single-target functions means almost all of a template's text stays as
 * the original placeholder copy, with just one heading/paragraph/button
 * changed anywhere on the page. This is what callers should use instead
 * when they have multiple pieces of generated content to distribute across
 * a template (e.g. one heading per section, one card per service).
 */
export function findAllNodesByWidgetType(
  nodes: ElementorNode[],
  widgetType: string
): ElementorNode[] {
  const matches: ElementorNode[] = [];

  function walk(list: ElementorNode[]) {
    for (const node of list) {
      if (node.elType === 'widget' && node.widgetType === widgetType) {
        matches.push(node);
      }
      if (node.elements) {
        walk(node.elements);
      }
    }
  }

  walk(nodes);
  return matches;
}

/**
 * Set the display text/value on a single node directly, given its widget
 * type. Used alongside findAllNodesByWidgetType to update a specific
 * occurrence rather than always the first one in the tree.
 */
export function setNodeContent(node: ElementorNode, text: string): void {
  if (!node.settings) node.settings = {};
  switch (node.widgetType) {
    case 'heading':
      node.settings.heading = text;
      break;
    case 'text-editor':
      node.settings.editor = `<p>${text}</p>`;
      break;
    case 'button':
      node.settings.text = text;
      break;
    default:
      break;
  }
}

/**
 * Find a node by target criteria
 */
function findNode(
  nodes: ElementorNode[],
  target: Modification['target']
): ElementorNode | null {
  for (const node of nodes) {
    if (target.nodeId && node.id === target.nodeId) {
      return node;
    }
    if (target.widgetType && node.elType === 'widget' && node.widgetType === target.widgetType) {
      return node;
    }
    if (node.elements) {
      const found = findNode(node.elements, target);
      if (found) return found;
    }
  }
  return null;
}

/**
 * Replace content in a node
 */
function replaceInNode(node: ElementorNode, changes: Record<string, unknown>): ModificationResult {
  if (!node.settings) {
    node.settings = {};
  }
  
  const modifications: string[] = [];
  
  for (const [key, newValue] of Object.entries(changes)) {
    const oldValue = node.settings[key];
    node.settings[key] = newValue;
    modifications.push(`Replaced ${key}: "${oldValue}" → "${newValue}"`);
  }
  
  return {
    success: true,
    modified: modifications.length > 0,
    modifications,
  };
}

/**
 * Modify node settings (shallow merge)
 */
function modifyNode(node: ElementorNode, changes: Record<string, unknown>): ModificationResult {
  if (!node.settings) {
    node.settings = {};
  }
  
  const modifications: string[] = [];
  
  for (const [key, value] of Object.entries(changes)) {
    node.settings[key] = value;
    modifications.push(`Set ${key} to ${JSON.stringify(value)}`);
  }
  
  return {
    success: true,
    modified: modifications.length > 0,
    modifications,
  };
}

// ============================================================================
// Convenience Methods
// ============================================================================

/**
 * Replace text in headings
 */
export function replaceHeading(nodes: ElementorNode[], newText: string): ModificationResult {
  return applyModifications(nodes, {
    elements: [{
      type: 'modify',
      target: { widgetType: 'heading' },
      changes: { heading: newText },
    }],
  });
}

/**
 * Replace text in text-editor widgets
 */
export function replaceParagraph(nodes: ElementorNode[], newText: string): ModificationResult {
  return applyModifications(nodes, {
    elements: [{
      type: 'modify',
      target: { widgetType: 'text-editor' },
      changes: { editor: `<p>${newText}</p>` },
    }],
  });
}

/**
 * Replace image URL
 */
export function replaceImage(nodes: ElementorNode[], newUrl: string): ModificationResult {
  return applyModifications(nodes, {
    elements: [{
      type: 'modify',
      target: { widgetType: 'image' },
      changes: { image: { url: newUrl } },
    }],
  });
}

/**
 * Replace button text and link
 */
export function replaceButton(
  nodes: ElementorNode[], 
  newText: string, 
  newUrl?: string
): ModificationResult {
  const changes: Record<string, unknown> = { text: newText };
  if (newUrl) {
    changes.link = { url: newUrl };
  }
  
  return applyModifications(nodes, {
    elements: [{
      type: 'modify',
      target: { widgetType: 'button' },
      changes,
    }],
  });
}

/**
 * Replace color value
 */
export function replaceColor(nodes: ElementorNode[], newColor: string): ModificationResult {
  // Find first widget with a color setting
  const target = findNodeWithColor(nodes);
  if (!target) {
    return {
      success: false,
      modified: false,
      modifications: [],
      error: 'No color field found to modify',
    };
  }
  
  return applyModifications(nodes, {
    elements: [{
      type: 'modify',
      target: { nodeId: target.id },
      changes: { primary_color: newColor },
    }],
  });
}

/**
 * Find first node with a color setting
 */
function findNodeWithColor(nodes: ElementorNode[]): ElementorNode | null {
  const colorFields = ['primary_color', 'secondary_color', 'background_color', 'text_color'];
  
  for (const node of nodes) {
    if (node.settings) {
      for (const field of colorFields) {
        if (field in node.settings) {
          return node;
        }
      }
    }
    if (node.elements) {
      const found = findNodeWithColor(node.elements);
      if (found) return found;
    }
  }
  return null;
}

/**
 * Replace text by searching for a pattern
 */
export function replaceTextPattern(
  nodes: ElementorNode[],
  searchFor: string,
  replaceWith: string
): ModificationResult {
  const modifications: string[] = [];
  let modified = false;
  
  const walk = (nodeList: ElementorNode[]) => {
    for (const node of nodeList) {
      if (node.settings) {
        for (const [key, value] of Object.entries(node.settings)) {
          if (typeof value === 'string' && value.includes(searchFor)) {
            node.settings[key] = value.replace(new RegExp(escapeRegex(searchFor), 'g'), replaceWith);
            modifications.push(`Replaced text in ${node.widgetType || node.elType}.${key}`);
            modified = true;
          }
        }
      }
      if (node.elements) {
        walk(node.elements);
      }
    }
  };
  
  walk(nodes);
  
  return {
    success: true,
    modified,
    modifications,
  };
}

function escapeRegex(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

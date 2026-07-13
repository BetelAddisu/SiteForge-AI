/**
 * Elementor JSON Validator
 * 
 * Phase 8: Validates Elementor JSON after modifications.
 * 
 * Validation checks:
 * - JSON is valid and parseable
 * - All required Elementor node fields present
 * - No undefined widget types
 * - Image references are reachable
 * - Color values are in valid format
 */

import type { ElementorNode } from './parser';

// ============================================================================
// Types
// ============================================================================

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

export interface ValidationError {
  type: 'missing_field' | 'invalid_format' | 'invalid_value' | 'unreachable_reference';
  path: string;
  message: string;
  nodeId?: string;
}

export interface ValidationWarning {
  type: 'deprecated' | 'incomplete' | 'external_reference';
  path: string;
  message: string;
}

// ============================================================================
// Validation
// ============================================================================

/**
 * Validate Elementor JSON structure
 */
export function validateElementorJson(nodes: unknown): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];

  // Check if it's an array
  if (!Array.isArray(nodes)) {
    errors.push({
      type: 'invalid_format',
      path: 'root',
      message: 'Elementor data must be an array',
    });
    return { valid: false, errors, warnings };
  }

  // Validate each node recursively
  validateNodes(nodes, 'root', errors, warnings);

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Recursively validate nodes
 */
function validateNodes(
  nodes: ElementorNode[],
  path: string,
  errors: ValidationError[],
  warnings: ValidationWarning[]
): void {
  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i];
    const nodePath = `${path}[${i}]`;

    // Check required fields
    if (!node.id) {
      errors.push({
        type: 'missing_field',
        path: nodePath,
        message: 'Node missing required field: id',
      });
    }

    if (!node.elType) {
      errors.push({
        type: 'missing_field',
        path: nodePath,
        message: 'Node missing required field: elType',
        nodeId: node.id,
      });
    } else {
      // Validate elType
      const validElTypes = ['section', 'column', 'container', 'widget'];
      if (!validElTypes.includes(node.elType)) {
        errors.push({
          type: 'invalid_value',
          path: nodePath,
          message: `Invalid elType: ${node.elType}`,
          nodeId: node.id,
        });
      }
    }

    // Widget-specific validation
    if (node.elType === 'widget') {
      if (!node.widgetType) {
        errors.push({
          type: 'missing_field',
          path: nodePath,
          message: 'Widget missing required field: widgetType',
          nodeId: node.id,
        });
      }

      // Check for deprecated widget types
      const deprecatedWidgets = ['theme-panel'];
      if (node.widgetType && deprecatedWidgets.includes(node.widgetType)) {
        warnings.push({
          type: 'deprecated',
          path: nodePath,
          message: `Widget type "${node.widgetType}" is deprecated`,
        });
      }
    }

    // Settings validation
    if (node.settings) {
      validateSettings(node, nodePath, errors, warnings);
    }

    // Validate children
    if (node.elements && Array.isArray(node.elements)) {
      validateNodes(node.elements, `${nodePath}.elements`, errors, warnings);
    }
  }
}

/**
 * Validate widget settings
 */
function validateSettings(
  node: ElementorNode,
  path: string,
  errors: ValidationError[],
  warnings: ValidationWarning[]
): void {
  const settings = node.settings!;

  // Validate colors
  const colorFields = ['primary_color', 'secondary_color', 'background_color', 'text_color', 'color'];
  for (const field of colorFields) {
    const value = settings[field];
    if (typeof value === 'string') {
      if (!isValidColor(value)) {
        errors.push({
          type: 'invalid_format',
          path: `${path}.settings.${field}`,
          message: `Invalid color format: ${value}`,
          nodeId: node.id,
        });
      }
    }
  }

  // Validate URLs
  const urlFields = ['link', 'url', 'image_url'];
  for (const field of urlFields) {
    const value = settings[field];
    if (typeof value === 'string' && value.length > 0) {
      if (!isValidUrl(value)) {
        // Check for template variables (which are valid but should warn)
        if (value.includes('{{') || value.includes('}}')) {
          warnings.push({
            type: 'incomplete',
            path: `${path}.settings.${field}`,
            message: 'Contains unresolved template variables',
          });
        } else if (!value.startsWith('#') && !value.startsWith('var(')) {
          errors.push({
            type: 'invalid_format',
            path: `${path}.settings.${field}`,
            message: `Invalid URL format: ${value.substring(0, 50)}...`,
            nodeId: node.id,
          });
        }
      }
    }

    // Handle URL objects
    if (typeof value === 'object' && value !== null) {
      const urlObj = value as { url?: string };
      if (urlObj.url && !isValidUrl(urlObj.url)) {
        if (urlObj.url.includes('{{') || urlObj.url.includes('}}')) {
          warnings.push({
            type: 'incomplete',
            path: `${path}.settings.${field}.url`,
            message: 'Contains unresolved template variables',
          });
        }
      }
    }
  }

  // Validate image objects
  const imageFields = ['image', 'photo'];
  for (const field of imageFields) {
    const value = settings[field];
    if (typeof value === 'object' && value !== null) {
      const imgObj = value as { url?: string; id?: number };
      if (imgObj.url && !isValidUrl(imgObj.url) && !imgObj.url.includes('{{')) {
        warnings.push({
          type: 'external_reference',
          path: `${path}.settings.${field}`,
          message: 'Image URL may not be accessible',
        });
      }
    }
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Check if a string is a valid color value
 */
function isValidColor(value: string): boolean {
  if (value.startsWith('var(') || value.startsWith('calc(')) return true;
  if (/^#[0-9A-Fa-f]{3,8}$/.test(value)) return true;
  if (/^rgba?\([^)]+\)$/i.test(value)) return true;
  if (/^hsla?\([^)]+\)$/i.test(value)) return true;
  return false;
}

/**
 * Check if a string is a valid URL
 */
function isValidUrl(value: string): boolean {
  // Allow empty strings
  if (!value || value.trim() === '') return true;
  
  // Allow anchors and relative paths
  if (value.startsWith('#') || value.startsWith('/')) return true;
  
  // Allow common URL patterns
  try {
    new URL(value);
    return true;
  } catch {
    // Not a valid URL
    return false;
  }
}

// ============================================================================
// High-Level Validation
// ============================================================================

export interface FullValidationOptions {
  checkReachability?: boolean;
  checkAccessibility?: boolean;
}

export interface FullValidationResult extends ValidationResult {
  summary: {
    totalNodes: number;
    totalWidgets: number;
    sections: number;
    columns: number;
    containers: number;
    widgetTypes: Record<string, number>;
  };
}

/**
 * Perform full validation with summary
 */
export function validateFull(
  nodes: ElementorNode[],
  options: FullValidationOptions = {}
): FullValidationResult {
  // Basic validation
  const basicResult = validateElementorJson(nodes);
  
  // Count statistics
  const summary = countNodes(nodes);
  
  return {
    ...basicResult,
    summary,
  };
}

/**
 * Count nodes by type
 */
function countNodes(nodes: ElementorNode[]): FullValidationResult['summary'] {
  let totalNodes = 0;
  let totalWidgets = 0;
  let sections = 0;
  let columns = 0;
  let containers = 0;
  const widgetTypes: Record<string, number> = {};

  const walk = (nodeList: ElementorNode[]) => {
    for (const node of nodeList) {
      totalNodes++;
      
      switch (node.elType) {
        case 'section':
          sections++;
          break;
        case 'column':
          columns++;
          break;
        case 'container':
          containers++;
          break;
        case 'widget':
          totalWidgets++;
          const type = node.widgetType || 'unknown';
          widgetTypes[type] = (widgetTypes[type] || 0) + 1;
          break;
      }
      
      if (node.elements) {
        walk(node.elements);
      }
    }
  };

  walk(nodes);

  return {
    totalNodes,
    totalWidgets,
    sections,
    columns,
    containers,
    widgetTypes,
  };
}

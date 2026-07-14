/**
 * Repair Engine
 * 
 * Phase 3C: Repairs deprecated or incompatible widgets in Elementor templates.
 * 
 * Scope: Limited to widget-type issues discovered during Phase 0 sample.
 * The mapping table expands incrementally - not speculatively upfront.
 */

import type { ElementorNode } from './parser';
import { analyzeCompatibility, type CompatibilityResult } from './compatibility-analyzer';
import { WIDGET_MAP, getRepairMapping, type RepairResult } from './widget-map';

// ============================================================================
// Types
// ============================================================================

export interface RepairReport {
  templateId: string;
  originalScore: number;
  finalScore: number;
  repairs: RepairAction[];
  errors: string[];
  warnings: string[];
  success: boolean;
}

export interface RepairAction {
  nodeId: string;
  widgetType: string;
  action: string;
  details: string;
}

export interface RepairOptions {
  dryRun: boolean;
  createSnapshot: boolean;
  maxRepairs: number;
  skipErrors: boolean;
}

// ============================================================================
// Repair Engine
// ============================================================================

/**
 * Repair a template
 */
export function repairTemplate(
  nodes: ElementorNode[],
  options: RepairOptions = { dryRun: false, createSnapshot: true, maxRepairs: 100, skipErrors: true }
): RepairReport {
  // Analyze before repair
  const analysis = analyzeCompatibility(nodes);
  
  const repairs: RepairAction[] = [];
  const errors: string[] = [];
  const warnings: string[] = [];
  
  // Apply generic repairs first
  applyGenericRepairs(nodes, repairs, warnings);
  
  // Apply specific widget repairs
  let repairCount = 0;
  for (const node of flattenNodes(nodes)) {
    if (repairCount >= options.maxRepairs) {
      warnings.push(`Max repairs (${options.maxRepairs}) reached`);
      break;
    }
    
    if (node.elType !== 'widget' || !node.widgetType) continue;
    
    const mapping = getRepairMapping(node.widgetType);
    if (mapping && mapping.sourceWidget !== '_normalize_colors' && mapping.sourceWidget !== '_fix_images') {
      try {
        const result = mapping.handler(node);
        
        if (result.modified) {
          repairs.push({
            nodeId: node.id,
            widgetType: node.widgetType,
            action: 'replaced',
            details: result.repairs.join(', '),
          });
          repairCount++;
        }
      } catch (error) {
        const errorMsg = `Failed to repair ${node.widgetType}: ${error}`;
        errors.push(errorMsg);
        
        if (!options.skipErrors) {
          throw new Error(errorMsg);
        }
      }
    }
  }
  
  // Analyze after repair
  const finalAnalysis = analyzeCompatibility(nodes);
  
  return {
    templateId: '', // Will be set by caller
    originalScore: analysis.score,
    finalScore: finalAnalysis.score,
    repairs,
    errors,
    warnings,
    success: errors.length === 0,
  };
}

/**
 * Apply generic repairs that apply to all widgets
 */
function applyGenericRepairs(
  nodes: ElementorNode[],
  repairs: RepairAction[],
  warnings: string[]
): void {
  // Apply color normalization
  const colorMapping = WIDGET_MAP['_normalize_colors'];
  if (colorMapping) {
    let colorRepairCount = 0;
    for (const node of flattenNodes(nodes)) {
      if (colorRepairCount > 50) break; // Limit to prevent excessive repairs
      
      const result = colorMapping.handler(node);
      if (result.modified) {
        repairs.push({
          nodeId: node.id,
          widgetType: node.widgetType || node.elType,
          action: 'normalized_colors',
          details: result.repairs.join(', '),
        });
        colorRepairCount++;
      }
    }
    if (colorRepairCount > 0) {
      warnings.push(`Normalized colors in ${colorRepairCount} widgets`);
    }
  }
  
  // Apply image fixes
  const imageMapping = WIDGET_MAP['_fix_images'];
  if (imageMapping) {
    let imageFixCount = 0;
    for (const node of flattenNodes(nodes)) {
      if (imageFixCount > 50) break;
      
      const result = imageMapping.handler(node);
      if (result.modified) {
        repairs.push({
          nodeId: node.id,
          widgetType: node.widgetType || node.elType,
          action: 'fixed_images',
          details: result.repairs.join(', '),
        });
        imageFixCount++;
      }
    }
    if (imageFixCount > 0) {
      warnings.push(`Fixed images in ${imageFixCount} widgets`);
    }
  }
}

/**
 * Flatten nodes for iteration
 */
function flattenNodes(nodes: ElementorNode[]): ElementorNode[] {
  const result: ElementorNode[] = [];
  
  const walk = (nodeList: ElementorNode[]) => {
    for (const node of nodeList) {
      result.push(node);
      if (node.elements) {
        walk(node.elements);
      }
    }
  };
  
  walk(nodes);
  return result;
}

/**
 * Repair a specific widget
 */
export function repairWidget(node: ElementorNode): RepairResult {
  if (node.elType !== 'widget' || !node.widgetType) {
    return { success: false, modified: false, repairs: [], errors: ['Not a widget'] };
  }
  
  const mapping = getRepairMapping(node.widgetType);
  if (!mapping) {
    return { success: false, modified: false, repairs: [], errors: ['No repair mapping'] };
  }
  
  return mapping.handler(node);
}

/**
 * Check if a template needs repairs
 */
export function needsRepairs(analysis: CompatibilityResult): boolean {
  return analysis.redWidgets.length > 0 || analysis.warnings.length > 0;
}

/**
 * Get repair estimate
 */
export function getRepairEstimate(analysis: CompatibilityResult): {
  totalRepairs: number;
  autoRepairs: number;
  manualRepairs: number;
  estimatedTime: string;
} {
  const totalRepairs = analysis.redWidgets.length;
  const autoRepairs = analysis.redWidgets.filter(w => {
    const mapping = getRepairMapping(w);
    return mapping?.repairable;
  }).length;
  const manualRepairs = totalRepairs - autoRepairs;
  
  // Rough time estimates
  const autoTimePerRepair = 1; // seconds
  const manualTimePerRepair = 60; // seconds (requires manual work)
  
  const totalSeconds = (autoRepairs * autoTimePerRepair) + (manualRepairs * manualTimePerRepair);
  const estimatedTime = totalSeconds < 60 
    ? `${totalSeconds}s` 
    : `${Math.round(totalSeconds / 60)}m`;
  
  return { totalRepairs, autoRepairs, manualRepairs, estimatedTime };
}

/**
 * Validate repairs
 */
export function validateRepairs(nodes: ElementorNode[]): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  for (const node of flattenNodes(nodes)) {
    // Check required fields
    if (!node.id) {
      errors.push(`Node missing id`);
    }
    if (!node.elType) {
      errors.push(`Node ${node.id} missing elType`);
    }
    if (node.elType === 'widget' && !node.widgetType) {
      errors.push(`Widget ${node.id} missing widgetType`);
    }
    
    // Check for invalid widget types
    if (node.elType === 'widget' && node.widgetType) {
      if (node.widgetType.includes('{{') || node.widgetType.includes('}}')) {
        errors.push(`Widget ${node.id} has unresolvable template variable in type`);
      }
    }
    
    // Check color values
    if (node.settings) {
      for (const [key, value] of Object.entries(node.settings)) {
        if (key.includes('color') && typeof value === 'string') {
          if (value.includes('{{') || value.includes('}}')) {
            errors.push(`Widget ${node.id} has unresolvable template variable in ${key}`);
          }
        }
      }
    }
  }
  
  return { valid: errors.length === 0, errors };
}

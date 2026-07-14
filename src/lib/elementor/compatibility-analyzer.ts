/**
 * Compatibility Analyzer
 * 
 * Phase 3B: Analyzes Elementor templates for modification compatibility.
 * 
 * Outputs:
 * - Score (0-100)
 * - Green/Yellow/Red widget categorizations
 * - Human-readable notes
 */

import type { ElementorNode, TemplateStructure } from './parser';
import { CORE_WIDGETS, PRO_WIDGETS, THIRD_PARTY_PREFIXES, ADDON_MAPPINGS } from './parser';

// ============================================================================
// Types
// ============================================================================

export type CompatibilityLevel = 'green' | 'yellow' | 'red';

export interface CompatibilityResult {
  score: number;
  level: CompatibilityLevel;
  easyWidgets: string[];
  yellowWidgets: string[];
  redWidgets: string[];
  notes: string[];
  warnings: string[];
  thirdPartyAddons: ThirdPartyAddon[];
}

export interface ThirdPartyAddon {
  name: string;
  widgetTypes: string[];
  severity: 'low' | 'medium' | 'high';
  repairable: boolean;
}

// ============================================================================
// Widget Modification Difficulty
// ============================================================================

interface WidgetInfo {
  difficulty: 'easy' | 'medium' | 'hard';
  repairable: boolean;
  notes: string[];
}

// Known widget handling info
const WIDGET_HANDLERS: Record<string, WidgetInfo> = {
  // Easy - Core widgets with standard modification
  'heading': { difficulty: 'easy', repairable: true, notes: [] },
  'text-editor': { difficulty: 'easy', repairable: true, notes: [] },
  'button': { difficulty: 'easy', repairable: true, notes: [] },
  'image': { difficulty: 'easy', repairable: true, notes: [] },
  'icon': { difficulty: 'easy', repairable: true, notes: [] },
  'icon-box': { difficulty: 'easy', repairable: true, notes: [] },
  'image-box': { difficulty: 'easy', repairable: true, notes: [] },
  'divider': { difficulty: 'easy', repairable: true, notes: [] },
  'spacer': { difficulty: 'easy', repairable: true, notes: [] },
  'counter': { difficulty: 'easy', repairable: true, notes: [] },
  'progress-bar': { difficulty: 'easy', repairable: true, notes: [] },
  'tabs': { difficulty: 'easy', repairable: true, notes: ['Tab content is in repeater format'] },
  'accordion': { difficulty: 'easy', repairable: true, notes: ['Accordion content is in repeater format'] },
  'toggle': { difficulty: 'easy', repairable: true, notes: ['Toggle content is in repeater format'] },
  'social-icons': { difficulty: 'easy', repairable: true, notes: [] },
  'call-to-action': { difficulty: 'easy', repairable: true, notes: [] },
  
  // Medium - Pro widgets or widgets with limitations
  'slides': { difficulty: 'medium', repairable: true, notes: ['Carousel with multiple slides in repeater'] },
  'testimonial-carousel': { difficulty: 'medium', repairable: true, notes: ['Testimonials in repeater format'] },
  'image-carousel': { difficulty: 'medium', repairable: true, notes: ['Images in repeater format'] },
  'flip-box': { difficulty: 'medium', repairable: true, notes: ['Front/back content pairs'] },
  'price-table': { difficulty: 'medium', repairable: true, notes: ['Multi-tier pricing structures'] },
  'price-box': { difficulty: 'medium', repairable: true, notes: ['Multi-tier pricing structures'] },
  
  // Hard - Dynamic content or complex widgets
  'posts': { difficulty: 'hard', repairable: false, notes: ['Dynamic content queries - modify settings only'] },
  'loop-grid': { difficulty: 'hard', repairable: false, notes: ['Dynamic content - modify settings only'] },
  'loop-carousel': { difficulty: 'hard', repairable: false, notes: ['Dynamic content - modify settings only'] },
  'template': { difficulty: 'hard', repairable: false, notes: ['Nested template - modify source instead'] },
  'form': { difficulty: 'hard', repairable: true, notes: ['Complex form fields in repeater'] },
  'slideshow': { difficulty: 'hard', repairable: true, notes: ['Multiple slides in complex format'] },
};

// ============================================================================
// Analysis Functions
// ============================================================================

/**
 * Analyze a template for modification compatibility
 */
export function analyzeCompatibility(nodes: ElementorNode[]): CompatibilityResult {
  const structure = analyzeStructure(nodes);
  
  const easyWidgets: string[] = [];
  const yellowWidgets: string[] = [];
  const redWidgets: string[] = [];
  const notes: string[] = [];
  const warnings: string[] = [];
  const thirdPartyAddons: ThirdPartyAddon[] = [];
  
  // Categorize each widget type
  for (const [widgetType, count] of structure.widgetTypes) {
    const info = WIDGET_HANDLERS[widgetType];
    
    if (!info) {
      // Unknown widget - check if third-party
      if (isThirdPartyWidget(widgetType)) {
        const addon = identifyThirdParty(widgetType);
        redWidgets.push(widgetType);
        warnings.push(`Unknown third-party widget: ${widgetType} (${addon})`);
        
        // Track addon
        const existingAddon = thirdPartyAddons.find(a => a.name === addon);
        if (existingAddon) {
          existingAddon.widgetTypes.push(widgetType);
        } else {
          thirdPartyAddons.push({
            name: addon,
            widgetTypes: [widgetType],
            severity: 'high',
            repairable: false,
          });
        }
      } else if (!CORE_WIDGETS.has(widgetType) && !PRO_WIDGETS.has(widgetType)) {
        yellowWidgets.push(widgetType);
        warnings.push(`Unknown widget type: ${widgetType}`);
      } else {
        // Known but not in handler map - treat as easy
        easyWidgets.push(widgetType);
      }
    } else {
      switch (info.difficulty) {
        case 'easy':
          easyWidgets.push(widgetType);
          break;
        case 'medium':
          yellowWidgets.push(widgetType);
          if (info.notes.length > 0) {
            notes.push(`${widgetType}: ${info.notes.join(', ')}`);
          }
          break;
        case 'hard':
          redWidgets.push(widgetType);
          warnings.push(`${widgetType}: ${info.notes.join(', ')}`);
          break;
      }
    }
  }
  
  // Calculate score
  const score = calculateScore(structure, easyWidgets, yellowWidgets, redWidgets);
  
  // Determine level
  let level: CompatibilityLevel;
  if (score >= 80) {
    level = 'green';
  } else if (score >= 50) {
    level = 'yellow';
  } else {
    level = 'red';
  }
  
  // Generate summary notes
  if (thirdPartyAddons.length > 0) {
    notes.push(`Found ${thirdPartyAddons.length} third-party addons requiring special handling`);
  }
  
  if (structure.maxNestingDepth > 5) {
    notes.push(`Deep nesting detected (${structure.maxNestingDepth} levels) - may affect reliability`);
  }
  
  return {
    score,
    level,
    easyWidgets: [...new Set(easyWidgets)],
    yellowWidgets: [...new Set(yellowWidgets)],
    redWidgets: [...new Set(redWidgets)],
    notes: [...new Set(notes)],
    warnings: [...new Set(warnings)],
    thirdPartyAddons,
  };
}

/**
 * Analyze template structure
 */
function analyzeStructure(nodes: ElementorNode[]): {
  widgetTypes: Map<string, number>;
  maxNestingDepth: number;
  totalWidgets: number;
} {
  const widgetTypes = new Map<string, number>();
  let maxNestingDepth = 0;
  let totalWidgets = 0;
  
  const walk = (nodeList: ElementorNode[], depth: number) => {
    for (const node of nodeList) {
      maxNestingDepth = Math.max(maxNestingDepth, depth);
      
      if (node.elType === 'widget') {
        totalWidgets++;
        const widgetType = node.widgetType || 'unknown';
        widgetTypes.set(widgetType, (widgetTypes.get(widgetType) || 0) + 1);
      }
      
      if (node.elements) {
        walk(node.elements, depth + 1);
      }
    }
  };
  
  walk(nodes, 0);
  
  return { widgetTypes, maxNestingDepth, totalWidgets };
}

/**
 * Calculate compatibility score
 */
function calculateScore(
  structure: ReturnType<typeof analyzeStructure>,
  easyWidgets: string[],
  yellowWidgets: string[],
  redWidgets: string[]
): number {
  let score = 100;
  
  // Deduct for third-party/red widgets (5 points each, max 40)
  const redCount = new Set(redWidgets).size;
  score -= Math.min(redCount * 5, 40);
  
  // Deduct for yellow widgets (3 points each, max 30)
  const yellowCount = new Set(yellowWidgets).size;
  score -= Math.min(yellowCount * 3, 30);
  
  // Deduct for deep nesting (5 points per level over 5, max 20)
  if (structure.maxNestingDepth > 5) {
    const nestingPenalty = (structure.maxNestingDepth - 5) * 5;
    score -= Math.min(nestingPenalty, 20);
  }
  
  // Deduct for excessive widgets (1 point per widget over 50, max 10)
  if (structure.totalWidgets > 50) {
    score -= Math.min(structure.totalWidgets - 50, 10);
  }
  
  return Math.max(0, Math.min(100, score));
}

/**
 * Check if widget is third-party
 */
function isThirdPartyWidget(widgetType: string): boolean {
  if (CORE_WIDGETS.has(widgetType)) return false;
  if (PRO_WIDGETS.has(widgetType)) return false;
  return THIRD_PARTY_PREFIXES.some(prefix => widgetType.startsWith(prefix));
}

/**
 * Identify third-party addon
 */
function identifyThirdParty(widgetType: string): string {
  for (const prefix of THIRD_PARTY_PREFIXES) {
    if (widgetType.startsWith(prefix)) {
      const key = prefix.replace(/-/g, '');
      return ADDON_MAPPINGS[key] || prefix.replace(/-/g, '');
    }
  }
  return 'Unknown';
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Get recommended repair priority for a template
 */
export function getRepairPriority(result: CompatibilityResult): {
  priority: 'none' | 'low' | 'medium' | 'high';
  effort: string;
} {
  if (result.level === 'green') {
    return { priority: 'none', effort: 'No repairs needed' };
  }
  
  const repairableWidgets = result.redWidgets.filter(w => {
    const info = WIDGET_HANDLERS[w];
    return info?.repairable;
  });
  
  const unRepairableWidgets = result.redWidgets.filter(w => {
    const info = WIDGET_HANDLERS[w];
    return !info?.repairable;
  });
  
  if (result.score >= 50 && unRepairableWidgets.length === 0) {
    return { 
      priority: 'low', 
      effort: `${repairableWidgets.length} widgets can be repaired automatically` 
    };
  }
  
  if (result.score >= 30) {
    return { 
      priority: 'medium', 
      effort: `${repairableWidgets.length} repairable, ${unRepairableWidgets.length} require manual work` 
    };
  }
  
  return { 
    priority: 'high', 
    effort: `${unRepairableWidgets.length} widgets cannot be repaired - consider skipping` 
  };
}

/**
 * Generate a human-readable report
 */
export function generateReport(result: CompatibilityResult): string {
  const lines: string[] = [];
  
  lines.push(`Compatibility Score: ${result.score}/100 (${result.level.toUpperCase()})`);
  lines.push('');
  
  if (result.easyWidgets.length > 0) {
    lines.push(`✅ Easy Widgets (${result.easyWidgets.length}):`);
    lines.push(`   ${result.easyWidgets.join(', ')}`);
    lines.push('');
  }
  
  if (result.yellowWidgets.length > 0) {
    lines.push(`🟡 Yellow Widgets (${result.yellowWidgets.length}):`);
    lines.push(`   ${result.yellowWidgets.join(', ')}`);
    lines.push('');
  }
  
  if (result.redWidgets.length > 0) {
    lines.push(`🔴 Red Widgets (${result.redWidgets.length}):`);
    lines.push(`   ${result.redWidgets.join(', ')}`);
    lines.push('');
  }
  
  if (result.thirdPartyAddons.length > 0) {
    lines.push('🔌 Third-Party Addons:');
    for (const addon of result.thirdPartyAddons) {
      lines.push(`   • ${addon.name}: ${addon.widgetTypes.join(', ')}`);
    }
    lines.push('');
  }
  
  if (result.notes.length > 0) {
    lines.push('📝 Notes:');
    for (const note of result.notes) {
      lines.push(`   • ${note}`);
    }
    lines.push('');
  }
  
  if (result.warnings.length > 0) {
    lines.push('⚠️  Warnings:');
    for (const warning of result.warnings) {
      lines.push(`   • ${warning}`);
    }
  }
  
  return lines.join('\n');
}

#!/usr/bin/env tsx
/**
 * parse-elementor.ts
 * 
 * Phase 0: Elementor Template Parser
 * Walks the Elementor JSON tree and produces a structural compatibility report.
 * 
 * Usage: npx tsx parse-elementor.ts <path-to-zip>
 */

import AdmZip from 'adm-zip';
import { readFileSync } from 'fs';
import { join, basename } from 'path';

// ============================================================================
// Types
// ============================================================================

interface ElementorNode {
  id: string;
  elType: 'section' | 'column' | 'container' | 'widget';
  widgetType?: string;
  settings?: Record<string, unknown>;
  elements?: ElementorNode[];
}

interface CompatibilityReport {
  templateName: string;
  filePath: string;
  stats: {
    totalSections: number;
    totalColumns: number;
    totalContainers: number;
    totalWidgets: number;
    maxNestingDepth: number;
  };
  widgetTypes: {
    type: string;
    count: number;
    category: 'core' | 'pro' | 'third-party' | 'unknown';
  }[];
  thirdPartyAddons: {
    addon: string;
    widgetTypes: string[];
  }[];
  compatibility: {
    score: number;
    level: 'green' | 'yellow' | 'red';
    easyWidgets: string[];
    brittleWidgets: string[];
    needsReview: string[];
  };
}

// Known Elementor core widget types
const CORE_WIDGETS = new Set([
  'heading', 'text-editor', 'image', 'button', 'icon', 'icon-box',
  'image-box', 'google-maps', 'divider', 'spacer', 'image-carousel',
  'image-gallery', 'icon-list', 'counter', 'progress-bar', 'tabs',
  'accordion', 'toggle', 'social-icons', 'image-hotspot', 'price-list',
  'flip-box', 'call-to-action', 'media-carousel', 'testimonial-carousel',
  'reviews', 'portfolio', 'slides', 'form', 'posts', 'archive-posts',
  'portfolio', 'template', 'shortcode', 'sidebar', 'nav-menu'
]);

// Known Elementor Pro widget types
const PRO_WIDGETS = new Set([
  'posts', 'portfolio', 'slides', 'form', 'login', 'register',
  'author-bio', 'archive-posts', 'archive-title', 'post-title',
  'post-excerpt', 'post-featured-image', 'post-info', 'post-navigation',
  'breadcrumbs', 'price-table', 'price-box', 'animated-headline',
  'flip-box', 'carousel', 'loop-grid', 'loop-carousel'
]);

// Known third-party addon prefixes (detected from widget type names)
const THIRD_PARTY_PREFIXES = [
  'ea-', 'eael-', 'tp-', 'uagb-', 'skt-', '陇', // Essential Addons, etc
  'uael-', 'ppe-', 'wts-', 'ht-', 'jet-', 'bdh-', 'pp-', 'oxi-'
];

// Third-party addon name mappings
const ADDON_MAPPINGS: Record<string, string> = {
  'ea': 'Essential Addons for Elementor',
  'eael': 'Essential Addons for Elementor',
  'uagb': 'Ultimate Addons for Gutenberg',
  'tp': 'Template Pack',
  'skt': 'SKT Templates',
  'uael': 'Ultimate Addons for Elementor',
  'ppe': 'Premium Addons for Elementor',
  'wts': 'WTS Elements',
  'ht': 'Hustle',
  'jet': 'JetElements',
  'bdh': 'Better Docs',
  'pp': 'PowerPack',
  'oxi': 'OXI Addons'
};

// ============================================================================
// Parser Functions
// ============================================================================

/**
 * Extracts _elementor_data from a ZIP file
 * Can be either a JSON file or embedded in PHP files
 */
function extractElementorData(zip: AdmZip, templateName: string): ElementorNode[] | null {
  // Try to find JSON file with elementor data
  const entries = zip.getEntries();
  
  // Look for explicit elementor data JSON files
  for (const entry of entries) {
    if (entry.entryName.includes('elementor') && 
        (entry.entryName.endsWith('.json') || entry.entryName.endsWith('.wxr'))) {
      try {
        const content = entry.getData().toString('utf8');
        const parsed = JSON.parse(content);
        if (Array.isArray(parsed) || (parsed.elements && Array.isArray(parsed.elements))) {
          return Array.isArray(parsed) ? parsed : parsed.elements;
        }
      } catch {
        // Continue searching
      }
    }
  }
  
  // Look in theme.json or template.json
  for (const entry of entries) {
    if (entry.entryName.endsWith('theme.json') || 
        entry.entryName.endsWith('template.json') ||
        entry.entryName.endsWith('data.json')) {
      try {
        const content = entry.getData().toString('utf8');
        const parsed = JSON.parse(content);
        if (parsed && (Array.isArray(parsed) || (parsed.elements && Array.isArray(parsed.elements)))) {
          return Array.isArray(parsed) ? parsed : parsed.elements;
        }
      } catch {
        // Continue
      }
    }
  }
  
  // Look for PHP files that might contain serialized elementor data
  for (const entry of entries) {
    if (entry.entryName.endsWith('.php')) {
      try {
        const content = entry.getData().toString('utf8');
        // Look for elementor data pattern in PHP files
        const match = content.match(/["']_elementor_data["']\s*=\s*(\[.*?\]);/s);
        if (match) {
          const parsed = JSON.parse(match[1]);
          if (Array.isArray(parsed)) {
            return parsed;
          }
        }
      } catch {
        // Continue
      }
    }
  }
  
  // Look for any file with elementor_data pattern
  for (const entry of entries) {
    if (entry.entryName.includes('elementor') || entry.entryName.includes('content')) {
      try {
        const content = entry.getData().toString('utf8');
        if (content.includes('_elementor_data') && content.includes('"elType"')) {
          // Try to extract JSON from the content
          const match = content.match(/\[.*"elType".*\]/s);
          if (match) {
            const parsed = JSON.parse(match[0]);
            if (Array.isArray(parsed)) {
              return parsed;
            }
          }
        }
      } catch {
        // Continue
      }
    }
  }
  
  console.warn(`⚠️  Could not find _elementor_data in ${templateName}`);
  return null;
}

/**
 * Recursively walks the Elementor JSON tree and collects statistics
 */
function walkTree(
  nodes: ElementorNode[],
  depth: number = 0,
  stats: CompatibilityReport['stats'] = {
    totalSections: 0,
    totalColumns: 0,
    totalContainers: 0,
    totalWidgets: 0,
    maxNestingDepth: 0
  },
  widgetCounts: Map<string, { count: number; category: 'core' | 'pro' | 'third-party' | 'unknown' }> = new Map()
): { stats: CompatibilityReport['stats']; widgetCounts: Map<string, { count: number; category: 'core' | 'pro' | 'third-party' | 'unknown' }> } {
  for (const node of nodes) {
    // Update max depth
    stats.maxNestingDepth = Math.max(stats.maxNestingDepth, depth);
    
    // Count by type
    switch (node.elType) {
      case 'section':
        stats.totalSections++;
        break;
      case 'column':
        stats.totalColumns++;
        break;
      case 'container':
        stats.totalContainers++;
        break;
      case 'widget':
        stats.totalWidgets++;
        const widgetType = node.widgetType || 'unknown';
        const category = categorizeWidget(widgetType);
        
        const existing = widgetCounts.get(widgetType) || { count: 0, category };
        widgetCounts.set(widgetType, { count: existing.count + 1, category });
        break;
    }
    
    // Recurse into children
    if (node.elements && node.elements.length > 0) {
      walkTree(node.elements, depth + 1, stats, widgetCounts);
    }
  }
  
  return { stats, widgetCounts };
}

/**
 * Categorizes a widget type as core, pro, or third-party
 */
function categorizeWidget(widgetType: string): 'core' | 'pro' | 'third-party' | 'unknown' {
  if (CORE_WIDGETS.has(widgetType)) return 'core';
  if (PRO_WIDGETS.has(widgetType)) return 'pro';
  
  // Check for third-party prefixes
  for (const prefix of THIRD_PARTY_PREFIXES) {
    if (widgetType.startsWith(prefix)) return 'third-party';
  }
  
  return 'unknown';
}

/**
 * Identifies third-party addons from widget types
 */
function identifyThirdPartyAddons(widgetTypes: { type: string; category: 'core' | 'pro' | 'third-party' | 'unknown' }[]): CompatibilityReport['thirdPartyAddons'] {
  const addonMap = new Map<string, Set<string>>();
  
  for (const { type, category } of widgetTypes) {
    if (category === 'third-party') {
      // Extract addon identifier from widget type (e.g., 'ea-heading' -> 'ea')
      const parts = type.split('-');
      let addonPrefix = parts[0];
      
      // Handle multi-part prefixes
      if (parts[0] === 'eael') addonPrefix = 'eael';
      else if (parts[0] === 'uagb') addonPrefix = 'uagb';
      else if (parts[0] === 'uael') addonPrefix = 'uael';
      
      const addonName = ADDON_MAPPINGS[addonPrefix] || addonPrefix;
      
      if (!addonMap.has(addonName)) {
        addonMap.set(addonName, new Set());
      }
      addonMap.get(addonName)!.add(type);
    }
  }
  
  return Array.from(addonMap.entries()).map(([addon, widgetTypes]) => ({
    addon,
    widgetTypes: Array.from(widgetTypes)
  }));
}

/**
 * Generates a compatibility report from parsed data
 */
function generateCompatibilityReport(
  stats: CompatibilityReport['stats'],
  widgetCounts: Map<string, { count: number; category: 'core' | 'pro' | 'third-party' | 'unknown' }>
): CompatibilityReport['compatibility'] {
  const easyWidgets: string[] = [];
  const brittleWidgets: string[] = [];
  const needsReview: string[] = [];
  
  // Categorize widgets by modifiability
  for (const [type, { category }] of widgetCounts) {
    if (category === 'core') {
      // Core widgets are generally easy to modify
      easyWidgets.push(type);
    } else if (category === 'pro') {
      // Pro widgets may have limitations
      needsReview.push(type);
    } else if (category === 'third-party') {
      // Third-party widgets may be brittle
      brittleWidgets.push(type);
    } else {
      // Unknown widgets need review
      needsReview.push(type);
    }
  }
  
  // Calculate score (0-100)
  // Start at 100, deduct for problematic widgets
  let score = 100;
  
  // Deduct for third-party widgets (5 points each, max 40)
  score -= Math.min(brittleWidgets.length * 5, 40);
  
  // Deduct for unknown widgets (3 points each, max 30)
  score -= Math.min(needsReview.length * 3, 30);
  
  // Deduct for widgets with complex nesting (max 20)
  if (stats.maxNestingDepth > 5) {
    score -= Math.min((stats.maxNestingDepth - 5) * 5, 20);
  }
  
  // Deduct for excessive widgets (max 10)
  if (stats.totalWidgets > 50) {
    score -= Math.min(stats.totalWidgets - 50, 10);
  }
  
  score = Math.max(0, score);
  
  let level: 'green' | 'yellow' | 'red';
  if (score >= 80) level = 'green';
  else if (score >= 50) level = 'yellow';
  else level = 'red';
  
  return { score, level, easyWidgets, brittleWidgets, needsReview };
}

/**
 * Generates a complete compatibility report for a template
 */
function generateReport(
  templateName: string,
  filePath: string,
  elementorData: ElementorNode[] | null
): CompatibilityReport {
  if (!elementorData) {
    return {
      templateName,
      filePath,
      stats: { totalSections: 0, totalColumns: 0, totalContainers: 0, totalWidgets: 0, maxNestingDepth: 0 },
      widgetTypes: [],
      thirdPartyAddons: [],
      compatibility: { score: 0, level: 'red', easyWidgets: [], brittleWidgets: [], needsReview: [] }
    };
  }
  
  const { stats, widgetCounts } = walkTree(elementorData);
  
  const widgetTypes = Array.from(widgetCounts.entries()).map(([type, { count, category }]) => ({
    type,
    count,
    category
  })).sort((a, b) => b.count - a.count);
  
  const thirdPartyAddons = identifyThirdPartyAddons(widgetTypes);
  const compatibility = generateCompatibilityReport(stats, widgetCounts);
  
  return {
    templateName,
    filePath,
    stats,
    widgetTypes,
    thirdPartyAddons,
    compatibility
  };
}

/**
 * Prints a formatted report to console
 */
function printReport(report: CompatibilityReport): void {
  console.log('\n' + '='.repeat(80));
  console.log(`📄 Template: ${report.templateName}`);
  console.log(`   Path: ${report.filePath}`);
  console.log('='.repeat(80));
  
  console.log('\n📊 Structure Statistics:');
  console.log(`   • Sections: ${report.stats.totalSections}`);
  console.log(`   • Columns: ${report.stats.totalColumns}`);
  console.log(`   • Containers: ${report.stats.totalContainers}`);
  console.log(`   • Widgets: ${report.stats.totalWidgets}`);
  console.log(`   • Max Nesting Depth: ${report.stats.maxNestingDepth}`);
  
  if (report.widgetTypes.length > 0) {
    console.log('\n🔧 Widget Types Found:');
    for (const { type, count, category } of report.widgetTypes) {
      const emoji = category === 'core' ? '✓' : category === 'pro' ? '★' : category === 'third-party' ? '⚠' : '?';
      console.log(`   ${emoji} ${type}: ${count} (${category})`);
    }
  }
  
  if (report.thirdPartyAddons.length > 0) {
    console.log('\n🔌 Third-Party Addons Detected:');
    for (const { addon, widgetTypes } of report.thirdPartyAddons) {
      console.log(`   📦 ${addon}:`);
      for (const type of widgetTypes) {
        console.log(`      - ${type}`);
      }
    }
  }
  
  console.log('\n🎯 Compatibility Assessment:');
  const levelColor = report.compatibility.level === 'green' ? '32' : 
                     report.compatibility.level === 'yellow' ? '33' : '31';
  console.log(`   • Score: \x1b[${levelColor}m${report.compatibility.score}/100\x1b[0m (${report.compatibility.level.toUpperCase()})`);
  
  if (report.compatibility.easyWidgets.length > 0) {
    console.log(`   ✅ Easy (${report.compatibility.easyWidgets.length}): ${report.compatibility.easyWidgets.slice(0, 5).join(', ')}${report.compatibility.easyWidgets.length > 5 ? '...' : ''}`);
  }
  
  if (report.compatibility.brittleWidgets.length > 0) {
    console.log(`   ⚠️  Brittle (${report.compatibility.brittleWidgets.length}): ${report.compatibility.brittleWidgets.slice(0, 5).join(', ')}${report.compatibility.brittleWidgets.length > 5 ? '...' : ''}`);
  }
  
  if (report.compatibility.needsReview.length > 0) {
    console.log(`   🔍 Needs Review (${report.compatibility.needsReview.length}): ${report.compatibility.needsReview.slice(0, 5).join(', ')}${report.compatibility.needsReview.length > 5 ? '...' : ''}`);
  }
  
  console.log('\n' + '-'.repeat(80));
}

// ============================================================================
// Main
// ============================================================================

function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.log('Usage: npx tsx parse-elementor.ts <path-to-zip-or-folder>');
    console.log('');
    console.log('Examples:');
    console.log('  npx tsx parse-elementor.ts ./sample-templates/template-1.zip');
    console.log('  npx tsx parse-elementor.ts ./sample-templates/');
    console.log('  npx tsx parse-elementor.ts ./sample-templates/template-1.zip ./sample-templates/template-2.zip');
    process.exit(1);
  }
  
  const reports: CompatibilityReport[] = [];
  
  for (const arg of args) {
    const stat = require('fs').statSync(arg);
    
    if (stat.isDirectory()) {
      // Process all ZIP files in the directory
      const files = require('fs').readdirSync(arg).filter(f => f.endsWith('.zip'));
      for (const file of files) {
        const zipPath = join(arg, file);
        console.log(`\n🔍 Processing: ${file}`);
        try {
          const zip = new AdmZip(zipPath);
          const templateName = basename(file, '.zip');
          const elementorData = extractElementorData(zip, templateName);
          const report = generateReport(templateName, zipPath, elementorData);
          reports.push(report);
          printReport(report);
        } catch (error) {
          console.error(`❌ Error processing ${file}:`, error);
        }
      }
    } else if (stat.isFile() && arg.endsWith('.zip')) {
      // Process single ZIP file
      console.log(`\n🔍 Processing: ${basename(arg)}`);
      try {
        const zip = new AdmZip(arg);
        const templateName = basename(arg, '.zip');
        const elementorData = extractElementorData(zip, templateName);
        const report = generateReport(templateName, arg, elementorData);
        reports.push(report);
        printReport(report);
      } catch (error) {
        console.error(`❌ Error processing ${arg}:`, error);
      }
    } else {
      console.warn(`⚠️  Skipping ${arg} - not a ZIP file`);
    }
  }
  
  // Print summary
  if (reports.length > 1) {
    console.log('\n\n' + '='.repeat(80));
    console.log('📈 SUMMARY');
    console.log('='.repeat(80));
    
    const green = reports.filter(r => r.compatibility.level === 'green').length;
    const yellow = reports.filter(r => r.compatibility.level === 'yellow').length;
    const red = reports.filter(r => r.compatibility.level === 'red').length;
    
    console.log(`   Total Templates: ${reports.length}`);
    console.log(`   ✅ Green (80-100): ${green}`);
    console.log(`   🟡 Yellow (50-79): ${yellow}`);
    console.log(`   🔴 Red (0-49): ${red}`);
    
    // Collect unique third-party addons
    const allAddons = new Map<string, Set<string>>();
    for (const report of reports) {
      for (const { addon, widgetTypes } of report.thirdPartyAddons) {
        if (!allAddons.has(addon)) {
          allAddons.set(addon, new Set());
        }
        for (const type of widgetTypes) {
          allAddons.get(addon)!.add(type);
        }
      }
    }
    
    if (allAddons.size > 0) {
      console.log('\n   🔌 Third-Party Addons Across Library:');
      for (const [addon, types] of allAddons) {
        console.log(`      • ${addon}: ${types.size} widget types`);
      }
    }
  }
  
  // Save JSON output if requested
  const outputPath = process.env.OUTPUT_PATH;
  if (outputPath) {
    require('fs').writeFileSync(outputPath, JSON.stringify(reports, null, 2));
    console.log(`\n📁 Report saved to: ${outputPath}`);
  }
}

main();

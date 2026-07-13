#!/usr/bin/env tsx
/**
 * modify-elementor.ts
 * 
 * Phase 0: Elementor Template Modifier
 * Programmatically modifies Elementor templates: text, images, colors, etc.
 * 
 * Usage: npx tsx modify-elementor.ts <path-to-zip> [options]
 * 
 * Options:
 *   --heading <text>     Replace first heading with this text
 *   --paragraph <text>   Replace first paragraph with this text
 *   --image <url>       Replace first image with this URL
 *   --color <color>     Replace first color value with this hex color
 *   --output <path>     Output ZIP path (default: modified-<original>.zip)
 */

import AdmZip from 'adm-zip';
import { writeFileSync, readFileSync, mkdirSync, rmSync, existsSync } from 'fs';
import { join, basename, dirname } from 'path';
import { tmpdir } from 'os';

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

interface Modification {
  type: 'heading' | 'paragraph' | 'image' | 'color' | 'text';
  originalValue: string;
  newValue: string;
  path: string[];
}

interface ModificationResult {
  success: boolean;
  modifications: Modification[];
  error?: string;
}

// ============================================================================
// Modification Handlers
// ============================================================================

/**
 * Find and replace text content in a node
 */
function findAndReplaceText(node: ElementorNode, searchFor: string, replaceWith: string, path: string[] = []): Modification | null {
  if (node.elType === 'widget' && node.settings) {
    const settings = node.settings;
    
    // Check common text fields
    const textFields = ['title', 'editor', 'text', 'content', 'subtitle', 'header_title', 'header_description'];
    
    for (const field of textFields) {
      const value = settings[field];
      if (typeof value === 'string' && value.includes(searchFor)) {
        const newValue = value.replace(new RegExp(escapeRegex(searchFor), 'g'), replaceWith);
        settings[field] = newValue;
        return {
          type: 'text',
          originalValue: value,
          newValue,
          path: [...path, `${node.widgetType}.${field}`]
        };
      }
      
      // Handle HTML content
      if (typeof value === 'string' && (value.includes(`>${searchFor}<`) || value.includes(`>${searchFor} </`))) {
        const newValue = value.replace(new RegExp(escapeRegex(`>${searchFor}<`), 'g'), `>${replaceWith}<`);
        settings[field] = newValue;
        return {
          type: 'text',
          originalValue: value,
          newValue,
          path: [...path, `${node.widgetType}.${field}`]
        };
      }
    }
    
    // Check heading-specific fields
    if (node.widgetType?.includes('heading')) {
      const headingFields = ['heading', 'header', 'title'];
      for (const field of headingFields) {
        const value = settings[field];
        if (typeof value === 'string' && value.includes(searchFor)) {
          const newValue = value.replace(new RegExp(escapeRegex(searchFor), 'g'), replaceWith);
          settings[field] = newValue;
          return {
            type: 'heading',
            originalValue: value,
            newValue,
            path: [...path, `${node.widgetType}.${field}`]
          };
        }
      }
    }
  }
  
  // Recurse into children
  if (node.elements && node.elements.length > 0) {
    for (const child of node.elements) {
      const result = findAndReplaceText(child, searchFor, replaceWith, [...path, node.id]);
      if (result) return result;
    }
  }
  
  return null;
}

/**
 * Find and replace image URLs
 */
function findAndReplaceImage(node: ElementorNode, replaceWith: string, path: string[] = []): Modification | null {
  if (node.settings) {
    const settings = node.settings;
    
    // Common image fields
    const imageFields = ['image', 'image_url', 'url', 'background_image', 'bg_image', 'logo'];
    
    for (const field of imageFields) {
      const value = settings[field];
      
      if (typeof value === 'string' && (value.startsWith('http') || value.startsWith('/') || value.includes('.jpg') || value.includes('.png') || value.includes('.svg') || value.includes('.webp'))) {
        settings[field] = replaceWith;
        return {
          type: 'image',
          originalValue: value,
          newValue: replaceWith,
          path: [...path, `${node.widgetType || node.elType}.${field}`]
        };
      }
      
      // Handle image objects (common in Elementor)
      if (typeof value === 'object' && value !== null && 'url' in value) {
        const imgObj = value as { url: string; id?: number };
        const originalUrl = imgObj.url;
        if (originalUrl) {
          imgObj.url = replaceWith;
          return {
            type: 'image',
            originalValue: originalUrl,
            newValue: replaceWith,
            path: [...path, `${node.widgetType || node.elType}.${field}`]
          };
        }
      }
    }
  }
  
  // Recurse into children
  if (node.elements && node.elements.length > 0) {
    for (const child of node.elements) {
      const result = findAndReplaceImage(child, replaceWith, [...path, node.id]);
      if (result) return result;
    }
  }
  
  return null;
}

/**
 * Find and replace color values
 */
function findAndReplaceColor(node: ElementorNode, replaceWith: string, path: string[] = []): Modification | null {
  if (node.settings) {
    const settings = node.settings;
    
    // Common color fields
    const colorFields = ['color', 'primary_color', 'secondary_color', 'background_color', 'text_color', 'button_background_color', 'heading_color', 'icon_color'];
    
    for (const field of colorFields) {
      const value = settings[field];
      
      if (typeof value === 'string') {
        // Match hex colors, rgb, rgba
        const colorPattern = /^(#[0-9A-Fa-f]{3,8}|rgba?\([^)]+\)|hsla?\([^)]+\))/;
        if (colorPattern.test(value)) {
          settings[field] = replaceWith;
          return {
            type: 'color',
            originalValue: value,
            newValue: replaceWith,
            path: [...path, `${node.widgetType || node.elType}.${field}`]
          };
        }
      }
    }
  }
  
  // Recurse into children
  if (node.elements && node.elements.length > 0) {
    for (const child of node.elements) {
      const result = findAndReplaceColor(child, replaceWith, [...path, node.id]);
      if (result) return result;
    }
  }
  
  return null;
}

/**
 * Extract elementor data from ZIP (reuse from parse-elementor.ts logic)
 */
function extractElementorData(zip: AdmZip): { data: ElementorNode[] | null; entryName: string | null } {
  const entries = zip.getEntries();
  
  for (const entry of entries) {
    if (entry.entryName.includes('elementor') && 
        (entry.entryName.endsWith('.json') || entry.entryName.endsWith('.wxr'))) {
      try {
        const content = entry.getData().toString('utf8');
        const parsed = JSON.parse(content);
        if (Array.isArray(parsed) || (parsed.elements && Array.isArray(parsed.elements))) {
          return { data: Array.isArray(parsed) ? parsed : parsed.elements, entryName: entry.entryName };
        }
      } catch {
        // Continue
      }
    }
  }
  
  for (const entry of entries) {
    if (entry.entryName.endsWith('theme.json') || 
        entry.entryName.endsWith('template.json') ||
        entry.entryName.endsWith('data.json')) {
      try {
        const content = entry.getData().toString('utf8');
        const parsed = JSON.parse(content);
        if (parsed && (Array.isArray(parsed) || (parsed.elements && Array.isArray(parsed.elements)))) {
          return { data: Array.isArray(parsed) ? parsed : parsed.elements, entryName: entry.entryName };
        }
      } catch {
        // Continue
      }
    }
  }
  
  // PHP extraction
  for (const entry of entries) {
    if (entry.entryName.endsWith('.php')) {
      try {
        const content = entry.getData().toString('utf8');
        const match = content.match(/["']_elementor_data["']\s*=\s*(\[.*?\]);/s);
        if (match) {
          const parsed = JSON.parse(match[1]);
          if (Array.isArray(parsed)) {
            return { data: parsed, entryName: entry.entryName };
          }
        }
      } catch {
        // Continue
      }
    }
  }
  
  return { data: null, entryName: null };
}

// ============================================================================
// Utilities
// ============================================================================

function escapeRegex(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function parseArgs(): { 
  inputPath: string; 
  outputPath: string | null;
  modifications: { type: string; value: string }[] 
} {
  const args = process.argv.slice(2);
  let inputPath: string | null = null;
  let outputPath: string | null = null;
  const modifications: { type: string; value: string }[] = [];
  
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--output' || arg === '-o') {
      outputPath = args[++i];
    } else if (arg === '--heading') {
      modifications.push({ type: 'heading', value: args[++i] });
    } else if (arg === '--paragraph') {
      modifications.push({ type: 'text', value: args[++i] });
    } else if (arg === '--image') {
      modifications.push({ type: 'image', value: args[++i] });
    } else if (arg === '--color') {
      modifications.push({ type: 'color', value: args[++i] });
    } else if (!arg.startsWith('-')) {
      inputPath = arg;
    }
  }
  
  if (!inputPath) {
    console.error('❌ Input ZIP path is required');
    process.exit(1);
  }
  
  return { inputPath, outputPath, modifications };
}

// ============================================================================
// Main
// ============================================================================

function main() {
  const { inputPath, outputPath, modifications } = parseArgs();
  
  if (modifications.length === 0) {
    console.log('Usage: npx tsx modify-elementor.ts <input.zip> [options]');
    console.log('');
    console.log('Options:');
    console.log('  --heading <text>     Replace first heading');
    console.log('  --paragraph <text>   Replace first paragraph');
    console.log('  --image <url>        Replace first image');
    console.log('  --color <hex>        Replace first color');
    console.log('  --output <path>      Output ZIP path');
    console.log('');
    console.log('Example:');
    console.log('  npx tsx modify-elementor.ts template.zip --heading "New Title" --output modified.zip');
    process.exit(1);
  }
  
  console.log(`📂 Loading: ${basename(inputPath)}`);
  
  try {
    const zip = new AdmZip(inputPath);
    const { data: elementorData, entryName } = extractElementorData(zip);
    
    if (!elementorData || !entryName) {
      console.error('❌ Could not extract Elementor data from ZIP');
      process.exit(1);
    }
    
    console.log(`✓ Found Elementor data in: ${entryName}`);
    console.log(`\n🔧 Applying ${modifications.length} modification(s)...`);
    
    const results: ModificationResult[] = [];
    
    for (const mod of modifications) {
      console.log(`   • ${mod.type}: "${mod.value}"`);
    }
    
    // Apply modifications
    for (const mod of modifications) {
      let found = false;
      
      for (const node of elementorData) {
        let result: Modification | null = null;
        
        switch (mod.type) {
          case 'heading':
          case 'text':
          case 'paragraph':
            result = findAndReplaceText(node, 'Lorem', mod.value);
            if (!result) {
              // Try first widget with any text
              result = findAndReplaceText(node, 'Welcome', mod.value);
            }
            if (!result) {
              result = findAndReplaceText(node, 'Sample', mod.value);
            }
            break;
          case 'image':
            result = findAndReplaceImage(node, mod.value);
            break;
          case 'color':
            result = findAndReplaceColor(node, mod.value);
            break;
        }
        
        if (result) {
          console.log(`\n✅ Applied ${result.type} modification:`);
          console.log(`   Path: ${result.path.join(' → ')}`);
          console.log(`   Before: "${result.originalValue.substring(0, 50)}${result.originalValue.length > 50 ? '...' : ''}"`);
          console.log(`   After:  "${result.newValue.substring(0, 50)}${result.newValue.length > 50 ? '...' : ''}"`);
          found = true;
          break;
        }
      }
      
      if (!found) {
        console.warn(`\n⚠️  Could not find element to modify for: ${mod.type}`);
      }
    }
    
    // Update the ZIP with modified data
    const modifiedContent = JSON.stringify(elementorData, null, 2);
    zip.updateFile(entryName, Buffer.from(modifiedContent, 'utf8'));
    
    // Determine output path
    const finalOutputPath = outputPath || inputPath.replace('.zip', '-modified.zip');
    
    // Write the modified ZIP
    zip.writeZip(finalOutputPath);
    
    console.log(`\n✅ Modified template saved to: ${finalOutputPath}`);
    
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

main();

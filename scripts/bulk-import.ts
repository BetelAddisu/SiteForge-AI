#!/usr/bin/env tsx
/**
 * bulk-import.ts
 * 
 * Phase 3A: Template Bulk Import Pipeline (Optimized)
 * 
 * Optimizations:
 * - Pre-fetch existing templates in ONE query at start (not N queries)
 * - Use prisma.$transaction for atomic template + sections creation
 * - Controlled concurrency with semaphore (not unbounded Promise.all)
 * - Single DB connection reused (not creating new client per operation)
 * - Batch idempotency checks using findMany with IN clause
 * 
 * Usage: npx tsx scripts/bulk-import.ts --source ./templates --concurrency 5
 */

import AdmZip from 'adm-zip';
import { PrismaClient } from '@prisma/client';
import { parseElementorTree, validateElementorJson, extractSections } from '../src/lib/elementor/parser';
import { extractGlobalStyles } from '../src/lib/elementor/global-styles';
import { writeFileSync, readdirSync, statSync } from 'fs';
import { join, basename } from 'path';

// ============================================================================
// Configuration
// ============================================================================

interface Config {
  sourcePath: string;
  concurrency: number;  // Max concurrent DB writes
  dryRun: boolean;
  skipExisting: boolean;
}

function parseArgs(): Config {
  const args = process.argv.slice(2);
  const config: Config = {
    sourcePath: './templates',
    concurrency: 5,  // Default: 5 concurrent DB writes
    dryRun: false,
    skipExisting: true,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    switch (arg) {
      case '--source':
        config.sourcePath = args[++i];
        break;
      case '--concurrency':
        config.concurrency = parseInt(args[++i], 10);
        break;
      case '--dry-run':
        config.dryRun = true;
        break;
      case '--no-skip':
        config.skipExisting = false;
        break;
    }
  }

  return config;
}

// ============================================================================
// Types
// ============================================================================

interface ImportResult {
  file: string;
  status: 'success' | 'skipped' | 'failed';
  templateId?: string;
  error?: string;
  stats?: {
    sections: number;
    widgets: number;
    compatibilityScore: number;
  };
}

interface ProcessingStats {
  total: number;
  succeeded: number;
  skipped: number;
  failed: number;
  startTime: Date;
  endTime?: Date;
}

// ============================================================================
// Prisma Client (single instance)
// ============================================================================

let prisma: PrismaClient;

function initPrisma(): PrismaClient {
  // Single Prisma client instance reused for entire import
  // Prisma manages connection pooling internally
  return new PrismaClient();
}

/**
 * Semaphore for controlled concurrency
 * Limits the number of concurrent DB operations
 */
class Semaphore {
  private running = 0;
  private queue: Array<() => void> = [];

  constructor(private maxConcurrent: number) {}

  async acquire(): Promise<void> {
    if (this.running < this.maxConcurrent) {
      this.running++;
      return;
    }
    return new Promise(resolve => {
      this.queue.push(resolve);
    });
  }

  release(): void {
    this.running--;
    const next = this.queue.shift();
    if (next) {
      this.running++;
      next();
    }
  }
}

// ============================================================================
// Elementor Data Extraction
// ============================================================================

interface ExtractedTemplate {
  name: string;
  filePath: string;
  elementorData: unknown[];
  metadata: {
    sections: number;
    columns: number;
    widgets: number;
    widgetTypes: Record<string, number>;
    thirdPartyWidgets: Record<string, string>;
  };
  globalStyles: ReturnType<typeof extractGlobalStyles>;
  sections: ReturnType<typeof extractSections>;
  compatibilityScore: number;
}

/**
 * Extract Elementor data from a ZIP file
 */
function extractFromZip(zipPath: string): ExtractedTemplate | null {
  try {
    const zip = new AdmZip(zipPath);
    const entries = zip.getEntries();
    
    // Find the elementor data file
    let elementorData: unknown = null;
    let entryName: string | null = null;
    
    for (const entry of entries) {
      if (entry.entryName.includes('elementor') && 
          (entry.entryName.endsWith('.json') || entry.entryName.endsWith('.wxr'))) {
        try {
          const content = entry.getData().toString('utf8');
          const parsed = JSON.parse(content);
          if (Array.isArray(parsed) || (parsed.elements && Array.isArray(parsed.elements))) {
            elementorData = parsed;
            entryName = entry.entryName;
            break;
          }
        } catch {
          // Continue searching
        }
      }
    }
    
    // Fallback: look for theme.json or template.json
    if (!elementorData) {
      for (const entry of entries) {
        if (entry.entryName.endsWith('theme.json') || 
            entry.entryName.endsWith('template.json') ||
            entry.entryName.endsWith('data.json')) {
          try {
            const content = entry.getData().toString('utf8');
            const parsed = JSON.parse(content);
            if (parsed && (Array.isArray(parsed) || (parsed.elements && Array.isArray(parsed.elements)))) {
              elementorData = parsed;
              entryName = entry.entryName;
              break;
            }
          } catch {
            // Continue
          }
        }
      }
    }
    
    if (!elementorData) {
      console.warn(`⚠️  Could not find elementor data in ${basename(zipPath)}`);
      return null;
    }
    
    const nodes = Array.isArray(elementorData) ? elementorData : elementorData.elements;
    
    if (!validateElementorJson(nodes)) {
      console.warn(`⚠️  Invalid elementor data format in ${basename(zipPath)}`);
      return null;
    }
    
    // Parse structure
    const structure = parseElementorTree(nodes);
    
    // Extract global styles
    const globalStyles = extractGlobalStyles(nodes);
    
    // Extract sections
    const sections = extractSections(nodes);
    
    // Calculate compatibility score
    const compatibilityScore = calculateCompatibilityScore(structure);
    
    return {
      name: basename(zipPath, '.zip'),
      filePath: zipPath,
      elementorData: nodes,
      metadata: {
        sections: structure.sections,
        columns: structure.columns,
        widgets: structure.widgets,
        widgetTypes: Object.fromEntries(structure.widgetTypes),
        thirdPartyWidgets: Object.fromEntries(structure.thirdPartyWidgets),
      },
      globalStyles,
      sections,
      compatibilityScore,
    };
  } catch (error) {
    console.error(`❌ Error extracting ${basename(zipPath)}:`, error);
    return null;
  }
}

/**
 * Calculate compatibility score based on template structure
 */
function calculateCompatibilityScore(structure: ReturnType<typeof parseElementorTree>): number {
  let score = 100;
  
  // Deduct for third-party widgets
  const thirdPartyCount = structure.thirdPartyWidgets.size;
  score -= Math.min(thirdPartyCount * 5, 40);
  
  // Deduct for unknown widgets
  const unknownWidgets = Array.from(structure.widgetTypes.entries())
    .filter(([type]) => !structure.thirdPartyWidgets.has(type))
    .filter(([type]) => {
      const coreWidgets = ['heading', 'text-editor', 'image', 'button', 'icon', 'icon-box', 
                          'image-box', 'divider', 'spacer', 'counter', 'progress-bar', 'tabs',
                          'accordion', 'toggle', 'social-icons', 'call-to-action'];
      return !coreWidgets.includes(type);
    });
  
  score -= Math.min(unknownWidgets.length * 3, 30);
  
  // Deduct for deep nesting
  if (structure.maxNestingDepth > 5) {
    score -= Math.min((structure.maxNestingDepth - 5) * 5, 20);
  }
  
  return Math.max(0, Math.min(100, score));
}

// ============================================================================
// Import Pipeline
// ============================================================================

/**
 * Process a single template ZIP
 * Uses $transaction to batch template + sections creation atomically
 */
async function processTemplate(
  zipPath: string,
  config: Config,
  stats: ProcessingStats,
  existingTemplates: Set<string>,
  semaphore: Semaphore
): Promise<ImportResult> {
  const fileName = basename(zipPath);
  
  // Wait for semaphore before starting DB work
  await semaphore.acquire();
  
  try {
    // Check if already imported (using pre-fetched set)
    if (config.skipExisting && existingTemplates.has(zipPath)) {
      return {
        file: fileName,
        status: 'skipped',
      };
    }
    
    // Extract data (CPU-bound, outside transaction)
    const extracted = extractFromZip(zipPath);
    
    if (!extracted) {
      return {
        file: fileName,
        status: 'failed',
        error: 'Could not extract elementor data',
      };
    }
    
    if (config.dryRun) {
      return {
        file: fileName,
        status: 'success',
        stats: {
          sections: extracted.metadata.sections,
          widgets: extracted.metadata.widgets,
          compatibilityScore: extracted.compatibilityScore,
        },
      };
    }
    
    // Use $transaction to create template + sections atomically
    // This reduces 4 DB round-trips to 1
    const result = await prisma.$transaction(async (tx) => {
      // Create template
      const template = await tx.template.create({
        data: {
          name: extracted.name,
          slug: extracted.name.toLowerCase().replace(/\s+/g, '-'),
          category: inferCategory(extracted.sections),
          filePath: zipPath,
          importStatus: 'PROCESSING',
          compatibilityScore: extracted.compatibilityScore,
          compatibilityNotes: {
            widgetTypes: extracted.metadata.widgetTypes,
            thirdPartyWidgets: extracted.metadata.thirdPartyWidgets,
          },
          metadata: extracted.metadata,
          globalStyles: extracted.globalStyles,
        },
      });
      
      // Create sections in batch
      if (extracted.sections.length > 0) {
        await tx.templateSection.createMany({
          data: extracted.sections.map((section, index) => ({
            templateId: template.id,
            type: section.type,
            title: section.title,
            content: section.content,
            order: index,
          })),
        });
      }
      
      // Create processing job
      await tx.processingJob.create({
        data: {
          stage: 'extract',
          status: 'COMPLETE',
          templateId: template.id,
        },
      });
      
      return template;
    });
    
    return {
      file: fileName,
      status: 'success',
      templateId: result.id,
      stats: {
        sections: extracted.metadata.sections,
        widgets: extracted.metadata.widgets,
        compatibilityScore: extracted.compatibilityScore,
      },
    };
  } catch (error) {
    return {
      file: fileName,
      status: 'failed',
      error: String(error),
    };
  } finally {
    semaphore.release();
  }
}

/**
 * Infer template category from sections
 */
function inferCategory(sections: ReturnType<typeof extractSections>): string {
  const sectionTypes = sections.map(s => s.type);
  
  if (sectionTypes.includes('hero')) return 'hero';
  if (sectionTypes.includes('contact')) return 'contact';
  if (sectionTypes.includes('pricing')) return 'pricing';
  if (sectionTypes.includes('team')) return 'team';
  if (sectionTypes.includes('testimonial')) return 'testimonial';
  if (sectionTypes.includes('features')) return 'features';
  
  return 'content';
}

/**
 * Process batch of templates with controlled concurrency
 * Uses semaphore to limit concurrent DB operations
 */
async function processBatch(
  files: string[],
  config: Config,
  stats: ProcessingStats,
  existingTemplates: Set<string>
): Promise<ImportResult[]> {
  const semaphore = new Semaphore(config.concurrency);
  const results: ImportResult[] = [];
  
  // Process all files with controlled concurrency
  // Each file waits on semaphore before starting DB work
  const promises = files.map(file => processTemplate(
    file,
    config,
    stats,
    existingTemplates,
    semaphore
  ));
  
  // Process results as they complete
  for (const promise of promises) {
    const result = await promise;
    stats.succeeded += result.status === 'success' ? 1 : 0;
    stats.skipped += result.status === 'skipped' ? 1 : 0;
    stats.failed += result.status === 'failed' ? 1 : 0;
    results.push(result);
    
    // Print progress
    const progress = Math.round(((stats.succeeded + stats.skipped + stats.failed) / stats.total) * 100);
    process.stdout.write(`\r📊 Progress: ${progress}% (${stats.succeeded + stats.skipped + stats.failed}/${stats.total})`);
  }
  
  console.log('');  // New line after progress
  return results;
}

// ============================================================================
// Main
// ============================================================================

async function main() {
  const config = parseArgs();
  
  console.log('═'.repeat(80));
  console.log('📦 SiteForge AI - Template Bulk Import (Optimized)');
  console.log('═'.repeat(80));
  console.log(`   Source: ${config.sourcePath}`);
  console.log(`   Concurrency: ${config.concurrency}`);
  console.log(`   Dry Run: ${config.dryRun}`);
  console.log(`   Skip Existing: ${config.skipExisting}`);
  console.log('');
  
  // Find all ZIP files
  let zipFiles: string[] = [];
  
  if (statSync(config.sourcePath).isDirectory()) {
    zipFiles = readdirSync(config.sourcePath)
      .filter(f => f.endsWith('.zip'))
      .map(f => join(config.sourcePath, f));
  } else if (config.sourcePath.endsWith('.zip')) {
    zipFiles = [config.sourcePath];
  }
  
  if (zipFiles.length === 0) {
    console.log('❌ No ZIP files found');
    process.exit(1);
  }
  
  console.log(`📁 Found ${zipFiles.length} ZIP files`);
  console.log('');
  
  // Initialize Prisma (single instance, reused)
  if (!config.dryRun) {
    prisma = initPrisma();
  }
  
  // Pre-fetch existing templates in ONE query (optimization)
  // Instead of N queries during processing
  console.log('🔍 Checking for existing templates...');
  const existingTemplates = config.dryRun ? new Set<string>() : (
    await prisma.template.findMany({
      where: { filePath: { in: zipFiles } },
      select: { filePath: true },
    })
  ).reduce((set, t) => set.add(t.filePath), new Set<string>());
  console.log(`   Found ${existingTemplates.size} already imported`);
  console.log('');
  
  // Process
  const stats: ProcessingStats = {
    total: zipFiles.length,
    succeeded: 0,
    skipped: 0,
    failed: 0,
    startTime: new Date(),
  };
  
  console.log('🚀 Starting import...\n');
  
  const results = await processBatch(zipFiles, config, stats, existingTemplates);
  
  stats.endTime = new Date();
  
  // Print summary
  const duration = (stats.endTime.getTime() - stats.startTime.getTime()) / 1000;
  
  console.log('\n' + '='.repeat(80));
  console.log('📈 IMPORT SUMMARY');
  console.log('='.repeat(80));
  console.log(`   Total Files: ${stats.total}`);
  console.log(`   ✅ Succeeded: ${stats.succeeded}`);
  console.log(`   ⏭️  Skipped: ${stats.skipped}`);
  console.log(`   ❌ Failed: ${stats.failed}`);
  console.log(`   Duration: ${duration.toFixed(1)}s`);
  if (duration > 0) {
    console.log(`   Rate: ${(stats.total / duration).toFixed(1)} templates/sec`);
  }
  
  // Show failures
  const failures = results.filter(r => r.status === 'failed');
  if (failures.length > 0) {
    console.log('\n❌ Failed Templates:');
    for (const failure of failures) {
      console.log(`   • ${failure.file}: ${failure.error}`);
    }
  }
  
  // Save results to file
  const outputPath = join(config.sourcePath, 'import-results.json');
  writeFileSync(outputPath, JSON.stringify({
    stats,
    results,
    timestamp: new Date().toISOString(),
  }, null, 2));
  
  console.log(`\n📁 Results saved to: ${outputPath}`);
  
  // Cleanup
  if (!config.dryRun) {
    await prisma.$disconnect();
  }
  
  process.exit(stats.failed > 0 ? 1 : 0);
}

main().catch(console.error);

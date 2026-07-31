#!/usr/bin/env tsx
/**
 * audit-widget-coverage.ts
 *
 * Scans every Elementor template kit in Cloudflare R2 and reports which
 * widget types the preview renderer (src/lib/preview/render.ts) does NOT
 * handle. This catches renderer gaps across all 200+ kits, not just the
 * few sample templates checked into the repo.
 *
 * Usage:
 *   npx tsx scripts/audit-widget-coverage.ts                # full scan
 *   npx tsx scripts/audit-widget-coverage.ts --limit 20     # scan first N zips
 *   npx tsx scripts/audit-widget-coverage.ts --json         # JSON output
 */

import { r2, R2_BUCKET, listFiles } from '../src/lib/storage/r2';
import { GetObjectCommand } from '@aws-sdk/client-s3';
import JSZip from 'jszip';
import * as fs from 'fs';
import * as path from 'path';

interface ManifestTemplate {
  name: string;
  source: string;
  type: string;
  metadata?: Record<string, unknown>;
  elementor_pro_required?: boolean;
}

interface Manifest {
  title: string;
  templates: ManifestTemplate[];
}

// Collect every widget type referenced in renderWidgetContent's switch.
function getHandledWidgetTypes(): Set<string> {
  const renderPath = path.join(__dirname, '..', 'src', 'lib', 'preview', 'render.ts');
  const source = fs.readFileSync(renderPath, 'utf8');
  const handled = new Set<string>();
  const switchStart = source.indexOf('switch (node.widgetType)');
  if (switchStart === -1) {
    console.error('Could not locate widget switch in render.ts');
    process.exit(1);
  }
  const switchBody = source.slice(switchStart, source.indexOf('default:', switchStart));
  const caseRe = /case\s+['"]([^'"]+)['"]:/g;
  let m: RegExpExecArray | null;
  while ((m = caseRe.exec(switchBody)) !== null) {
    handled.add(m[1]);
  }
  return handled;
}

function walkElements(node: any, widgetTypes: Map<string, number>): void {
  if (!node) return;
  if (node.elType === 'widget' && typeof node.widgetType === 'string') {
    widgetTypes.set(node.widgetType, (widgetTypes.get(node.widgetType) || 0) + 1);
  }
  if (Array.isArray(node.elements)) {
    for (const child of node.elements) walkElements(child, widgetTypes);
  }
}

async function getZipData(zipName: string): Promise<Buffer | null> {
  try {
    const command = new GetObjectCommand({ Bucket: R2_BUCKET, Key: zipName });
    const response = await r2.send(command);
    const bytes = await response.Body?.transformToByteArray();
    return bytes ? Buffer.from(bytes) : null;
  } catch (error) {
    console.error(`  [error] ${zipName}: ${error instanceof Error ? error.message : String(error)}`);
    return null;
  }
}

async function scanZip(zipName: string, handled: Set<string>, report: Map<string, Set<string>>): Promise<void> {
  const data = await getZipData(zipName);
  if (!data) return;

  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(data);
  } catch {
    return;
  }

  const manifestEntry = zip.file('manifest.json') || zip.file('kit-manifest.json');
  if (!manifestEntry) return;

  let manifest: Manifest;
  try {
    manifest = JSON.parse(await manifestEntry.async('string'));
  } catch {
    return;
  }

  const widgetTypes = new Map<string, number>();
  for (const template of manifest.templates || []) {
    if (template.elementor_pro_required) continue;
    const entry = zip.file(template.source);
    if (!entry) continue;
    try {
      const raw = await entry.async('string');
      const json = JSON.parse(raw);
      // Real structure is { content: [...] }; some files put the array at top level
      const roots: unknown[] =
        (Array.isArray(json?.content?.content) && json.content.content) ||
        (Array.isArray(json?.content) && json.content) ||
        (Array.isArray(json) && json) ||
        [];
      for (const root of roots) walkElements(root, widgetTypes);
    } catch {
      // skip unparseable template
    }
  }

  for (const [widgetType] of widgetTypes) {
    if (!handled.has(widgetType)) {
      if (!report.has(widgetType)) report.set(widgetType, new Set());
      report.get(widgetType)!.add(zipName);
    }
  }
}

async function main() {
  const args = process.argv.slice(2);
  const limitArg = args.find(a => a.startsWith('--limit'));
  const limit = limitArg ? parseInt(limitArg.split('=')[1] || args[args.indexOf(limitArg) + 1], 10) : Infinity;
  const asJson = args.includes('--json');

  console.log(`[audit] Bucket: ${R2_BUCKET}`);
  const zipFiles = (await listFiles('')).filter(f => f.endsWith('.zip'));
  console.log(`[audit] Found ${zipFiles.length} ZIP files in R2`);

  const handled = getHandledWidgetTypes();
  console.log(`[audit] Renderer handles ${handled.size} widget types`);

  const report = new Map<string, Set<string>>();
  const toScan = limit === Infinity ? zipFiles : zipFiles.slice(0, limit);

  for (let i = 0; i < toScan.length; i++) {
    const zipName = toScan[i];
    process.stdout.write(`[audit] ${i + 1}/${toScan.length} ${zipName}\n`);
    await scanZip(zipName, handled, report);
  }

  const sorted = Array.from(report.entries()).sort((a, b) => b[1].size - a[1].size);

  if (asJson) {
    const jsonOut = sorted.map(([type, kits]) => ({
      widgetType: type,
      kitCount: kits.size,
      kits: Array.from(kits).sort(),
    }));
    console.log(JSON.stringify({ unhandledWidgets: jsonOut }, null, 2));
    return;
  }

  console.log('\n' + '='.repeat(70));
  console.log(`UNHANDLED WIDGET TYPES (${sorted.length})`);
  console.log('='.repeat(70));
  for (const [type, kits] of sorted) {
    const kitList = Array.from(kits).sort().join(', ');
    console.log(`\n  ${type}  (in ${kits.size} kit${kits.size === 1 ? '' : 's'})`);
    console.log(`    kits: ${kitList.slice(0, 400)}${kitList.length > 400 ? '…' : ''}`);
  }
  console.log('\n' + '='.repeat(70));
  console.log('DONE');
}

main().catch(err => {
  console.error('[audit] Fatal:', err);
  process.exit(1);
});

#!/usr/bin/env node
/**
 * Visual QA batch runner.
 *
 * Runs once per template (not per website generation - see visual-qa.ts
 * for why). For each template: renders it with its own original content,
 * screenshots the result, compares against the template's real reference
 * screenshot using Gemini vision, and stores a structured report on the
 * Template row. Prints an aggregated, frequency-sorted summary at the end
 * so you know which SHARED renderer bug to fix next, instead of finding
 * them one template at a time via manual screenshot comparison.
 *
 * Usage:
 *   npm run qa:visual                    # all templates missing a QA report
 *   npm run qa:visual -- --limit=20     # just the first few
 *   npm run qa:visual -- --force        # re-check even templates with a report
 *   npm run qa:visual -- --kit=creato   # only templates from a specific kit slug
 */
import { prisma } from '../../src/lib/prisma';
import { renderElementorToHtml, type ElementorNode } from '../../src/lib/preview/render';
import { captureScreenshot } from '../../src/lib/preview/screenshot';
import { compareScreenshots, aggregateReports, type VisualQaReport } from '../../src/lib/elementor/visual-qa';

interface CliArgs {
  limit?: number;
  force: boolean;
  kit?: string;
}

function parseArgs(): CliArgs {
  const args: CliArgs = { force: false };
  for (const arg of process.argv.slice(2)) {
    if (arg.startsWith('--limit=')) args.limit = parseInt(arg.split('=')[1], 10);
    else if (arg === '--force') args.force = true;
    else if (arg.startsWith('--kit=')) args.kit = arg.split('=')[1];
  }
  return args;
}

async function fetchImageAsBase64(url: string): Promise<string | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const buffer = Buffer.from(await res.arrayBuffer());
    return buffer.toString('base64');
  } catch {
    return null;
  }
}

async function main() {
  const args = parseArgs();
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error('GEMINI_API_KEY is not set. Visual QA requires it for the vision comparison step.');
    process.exit(1);
  }

  const where: Record<string, unknown> = {};
  if (!args.force) where.visualQaCheckedAt = null;
  if (args.kit) where.kitSlug = args.kit;

  const templates = await prisma.template.findMany({
    where,
    take: args.limit,
    include: { sections: true },
  });

  console.log(`\n=== SiteForge Visual QA ===`);
  console.log(`Checking ${templates.length} template(s)...\n`);

  const reports: VisualQaReport[] = [];
  let succeeded = 0;
  let failed = 0;

  for (const template of templates) {
    process.stdout.write(`  ${template.name} (${template.kitSlug || 'no-kit'})... `);

    try {
      if (!template.previewImage) {
        console.log('SKIP (no reference screenshot)');
        continue;
      }

      const section = template.sections[0];
      const metadataContent = (template.metadata as { content?: unknown[] } | null)?.content;
      const content = (section?.content as unknown[]) ?? metadataContent ?? [];

      if (content.length === 0) {
        console.log('SKIP (no widget content - re-run template import)');
        continue;
      }

      const html = renderElementorToHtml(content as ElementorNode[], { title: template.name });
      const renderedBuffer = await captureScreenshot(html, { width: 1200, height: 1600, fullPage: true });
      const renderedBase64 = renderedBuffer.toString('base64');

      const referenceBase64 = await fetchImageAsBase64(template.previewImage);
      if (!referenceBase64) {
        console.log('SKIP (could not fetch reference screenshot)');
        continue;
      }

      const result = await compareScreenshots(referenceBase64, renderedBase64, {
        apiKey,
        templateName: template.name,
      });

      if (!result.success || !result.data) {
        console.log(`FAILED (${result.error})`);
        failed++;
        continue;
      }

      await prisma.template.update({
        where: { id: template.id },
        data: {
          visualQaReport: result.data as object,
          visualQaCheckedAt: new Date(),
        },
      });

      reports.push(result.data);
      succeeded++;
      console.log(`OK (similarity: ${result.data.similarityScore}%)`);
    } catch (err) {
      console.log(`ERROR (${err})`);
      failed++;
    }
  }

  console.log(`\n=== Results ===`);
  console.log(`Checked: ${succeeded} | Failed: ${failed} | Skipped: ${templates.length - succeeded - failed}`);

  if (reports.length > 0) {
    const summary = aggregateReports(reports);
    console.log(`\n=== Aggregate Summary (prioritize fixes by frequency) ===`);
    console.log(`Average similarity score: ${summary.averageSimilarityScore}%`);
    console.log(`Background issues:  ${summary.backgroundIssueCount}/${summary.totalTemplates} templates`);
    console.log(`Contrast issues:    ${summary.contrastIssueCount}/${summary.totalTemplates} templates`);
    console.log(`Missing images:     ${summary.missingImagesCount}/${summary.totalTemplates} templates`);
    console.log(`Missing icons:      ${summary.missingIconsCount}/${summary.totalTemplates} templates`);

    if (summary.commonLayoutIssues.length > 0) {
      console.log(`\nMost common layout issues:`);
      for (const { issue, count } of summary.commonLayoutIssues.slice(0, 10)) {
        console.log(`  [${count}x] ${issue}`);
      }
    }

    if (summary.commonMissingWidgetTypes.length > 0) {
      console.log(`\nMost commonly missing/broken widget types:`);
      for (const { widgetType, count } of summary.commonMissingWidgetTypes.slice(0, 10)) {
        console.log(`  [${count}x] ${widgetType}`);
      }
    }
  }

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
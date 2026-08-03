#!/usr/bin/env node
/**
 * Visual QA batch runner.
 *
 * Runs once per template (not per generation). For each template:
 * 1. Renders it with original content
 * 2. Screenshots the result
 * 3. Compares against reference screenshot using Gemini vision
 * 4. Stores report on Template row
 *
 * Usage:
 *   npm run qa:visual                    # all templates missing a QA report
 *   npm run qa:visual -- --limit=20     # just first 20
 *   npm run qa:visual -- --force        # re-check even templates with a report
 *   npm run qa:visual -- --kit=creato   # only templates from specific kit
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
    console.error('GEMINI_API_KEY is not set.');
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
        console.log('SKIP (no widget content)');
        continue;
      }

      const html = renderElementorToHtml(content as ElementorNode[], { title: template.name });
      const renderedBuffer = await captureScreenshot(html, { width: 1200, height: 1600, fullPage: true });
      const renderedBase64 = renderedBuffer.toString('base64');

      const referenceBase64 = await fetchImageAsBase64(template.previewImage);
      if (!referenceBase64) {
        console.log('SKIP (could not fetch reference)');
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
    console.log(`\n=== Aggregate Summary ===`);
    console.log(`Average similarity: ${summary.averageSimilarityScore}%`);
    console.log(`Background issues:  ${summary.backgroundIssueCount}/${summary.totalTemplates}`);
    console.log(`Contrast issues:    ${summary.contrastIssueCount}/${summary.totalTemplates}`);
    console.log(`Missing icons:      ${summary.missingIconsCount}/${summary.totalTemplates}`);

    if (summary.commonLayoutIssues.length > 0) {
      console.log(`\nMost common layout issues:`);
      for (const { issue, count } of summary.commonLayoutIssues.slice(0, 10)) {
        console.log(`  [${count}x] ${issue}`);
      }
    }
  }

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
